(function() {
  var maria = angular.module('maria', ['ngSanitize', 'ngAnimate', 'LocalStorageModule', 'JiraModule', 'xeditable', 'ui.bootstrap']);

  // -------------------------------------------------------------------------------------------
  // CONFIG
  // -------------------------------------------------------------------------------------------

  // set app prefix to not confuse other apps' data
  maria.config(['localStorageServiceProvider', function(localStorageServiceProvider) {
    localStorageServiceProvider.setPrefix('maria');
  }]);

  // set app prefix to not confuse other apps' data
  maria.config(['jiraServiceProvider', function(jiraServiceProvider) {
    jiraServiceProvider.setBaseUrl('http://jira');
  }]);

  // xeditable
  maria.run(['editableOptions', function(editableOptions) {
    editableOptions.theme = 'bs3'; // bootstrap3 theme. Can be also 'bs2', 'default'
  }]);

  // -------------------------------------------------------------------------------------------
  // CONTROLLERS
  // -------------------------------------------------------------------------------------------

  maria.controller('myController', ['$scope', '$timeout', 'localStorageService', 'jiraService', function($scope, $timeout, localStorageService, jiraService) {

    // tasks
    // -------------------------------------------------------------------------------------------

    function getLocalTasks () {
      var
        pinned_tasks = localStorageService.get('tasks') || [],
        p = pinned_tasks.length;
      while (--p >= 0) pinned_tasks[p].pinned = true;
      return pinned_tasks;
    };

    function updateLocalTasks () {
      var
        pinned_tasks = $scope.pinned_tasks,
        p = pinned_tasks.length;

      while (--p >= 0) {
        (function (p) {
          pinned_tasks[p].updating = true;
          jiraService.getTask(pinned_tasks[p].code).then(function (task) {
            task.local_comment = pinned_tasks[p].local_comment;
            task.updating = false;
            $scope.pinned_tasks[p] = task;
          });
        })(p);
      };
    };

    function saveLocalTasks (tasks) {
      var result = [];
      angular.forEach(tasks, function (task) {
        var trimmed = {};
        trimmed.code = task.code;
        trimmed.url = task.url;
        trimmed.local_comment = task.local_comment;
        result.push(trimmed);
      });
      localStorageService.set('tasks', result);
    };

    function taskIsPinned (task) {
      var
        tasks = $scope.pinned_tasks,
        i = tasks.length - 1,
        result;
      while ((i >= 0) && (tasks[i].code !== task.code)) i--;
      return i + 1;
    };

    function toggleLocalTask (task) {
      if (task.code) {
        var
          tasks = $scope.pinned_tasks,
          pinned = taskIsPinned(task);

        if (task.pinned) {
          task.pinned = false;
          tasks.splice(pinned - 1, 1);
        } else {
          task.pinned = true;
          tasks.push(task);
        }

        saveLocalTasks(tasks);
      }
    };

    function validateTaskCode (newTask) {
      var pattern = /^[a-zA-Z]{1,10}-[0-9]{1,5}$/;
      newTask.error = false;
      newTask.valid = pattern.test(newTask.code);
    };

    function propagatePinnedToRegular (task) {
      var
        task_code = task.code,
        system_code = task.code.split('-')[0],
        systems = $scope.systems,
        s = systems.length,
        tasks, t;

      // find target system
      while (--s >= 0 && !(systems[s].code === system_code)) {};
      
      // if system found
      if (s >= 0) {

        // find task
        tasks = systems[s].tasks;
        t = tasks.length;
        while (--t >= 0) {
          if (tasks[t].code = task_code) {
            tasks[t] = task;
            break;
          }
        };
      };
    };

    function updateLocalComment (data, task) {
      var
        pinned_tasks = $scope.pinned_tasks,
        p = taskIsPinned(task),
        task = pinned_tasks[p - 1];

      task.local_comment = data;
      saveLocalTasks(pinned_tasks);
      propagatePinnedToRegular(task);
    };

    function updateLocalTask (pinned_task) {
      if (!pinned_task.updating) {
        pinned_task.updating = true;
        pinned_task.code = pinned_task.code.toUpperCase();

        var
          pinned_tasks = $scope.pinned_tasks,
          p = taskIsPinned(pinned_task);

        if (p) { // task is already pinned
          jiraService.getTask(pinned_task.code).then(function (task) {
            task.local_comment = pinned_task.local_comment;
            pinned_tasks[p - 1] = task;
            propagatePinnedToRegular(task);
            pinned_task.updating = false;
            pinned_task.code = '';
          });
        } else { // user adds new task
          pinned_task.error = '';
          jiraService.getTask(pinned_task.code).then(
            function (task) {
              $scope.pinned_tasks.push(task);
              saveLocalTasks($scope.pinned_tasks);
              propagatePinnedToRegular(task);
              pinned_task.code = '';
              pinned_task.valid = false;
              pinned_task.updating = false;
            },
            function (reason) {
              pinned_task.updating = false;
              pinned_task.error = true;
            }
          );
        }
      }
    };


    // systems
    // -------------------------------------------------------------------------------------------

    function getLocalSystems () {
      return localStorageService.get('systems') || [];
    };
    
    function saveLocalSystems (systems) {
      var result = [];
      angular.forEach(systems, function (system) {
        var trimmed = {};
        trimmed.pid = system.pid;
        trimmed.url = system.url;
        trimmed.code = system.code;
        trimmed.name = system.name;
        trimmed.category = system.category;
        result.push(trimmed);
      });
      localStorageService.set('systems', result);
    };

    function addLocalSystem (system, systems) {
      if (system.code) {
        // check if that one exists
        var i = systems.length - 1;
        while ((i >= 0) && (systems[i].code !== system.code)) i--;
        if (i < 0) {
          // if ok, fetch pid
          jiraService.getPid(system.url).then( function(pid) {
            system.pid = pid;
            system.opened = false;
            systems.push(system);
            saveLocalSystems(systems);
          });
        }
      }
    };

    function delLocalSystem (system, systems) {
      systems.splice(systems.indexOf(system), 1);
      saveLocalSystems(systems);
      //$scope.$apply();
    };

    function getTasks (system) {
      system.tasks = undefined;
      jiraService.getTasks(system.pid).then( function (tasks) {
        var
          pinned_tasks = $scope.pinned_tasks,
          p = pinned_tasks.length,
          t = tasks.length;

        while (--p >= 0) {
          while (--t >= 0) {
            if (tasks[t].code === pinned_tasks[p].code) {
              tasks[t].pinned = true;
              tasks[t].local_comment = pinned_tasks[p].local_comment;
              pinned_tasks[p] = tasks[t];
              break;
            }
          }
        }

        system.tasks = tasks;
      });
    };


    // jira
    // -------------------------------------------------------------------------------------------

    // preloader
    $scope.connection_timeout = false;
    $timeout(function () {
      $scope.connection_timeout = true;
    }, 3000);

    // ui
    $scope.addLocalSystem = addLocalSystem;
    $scope.delLocalSystem = delLocalSystem;
    $scope.getTasks = getTasks;
    $scope.taskIsPinned = taskIsPinned;
    $scope.toggleLocalTask = toggleLocalTask;
    $scope.updateLocalComment = updateLocalComment;
    $scope.updateLocalTask = updateLocalTask;
    $scope.validateTaskCode = validateTaskCode;

    // user
    jiraService.getUser().then(function(data) {
      $scope.user = data;
    });

    // tasks
    $scope.pinned_tasks = getLocalTasks();
    updateLocalTasks();

    // systems
    $scope.systems = { _new: {} };
    $scope.systems.local = getLocalSystems();
    jiraService.getSystems().then( function (data) {
      $scope.systems.jira = data;
      $scope.selectpicker();
    });


    // various
    // -------------------------------------------------------------------------------------------

    // selectpicker workaround
    $scope.selectpicker = {};

    // collapses
    $scope.collapse = {};
    $scope.collapse.newSystem = true;
    $scope.collapse.newTask = true;

    // add task
    $scope.newTask = {
      code: ''
    };

  }]);

  
  // -------------------------------------------------------------------------------------------
  // DIRECTIVES
  // -------------------------------------------------------------------------------------------

  maria.directive('mySelectpicker', ['$timeout', function ($timeout) {
    return {
      restrict: 'A',
      //scope: { mySelectpicker: '=' },
      link: function (scope, element, attrs) {
        scope.selectpicker = function() {
          $timeout(function() { element.selectpicker(); }, 200);
        };
      }
    };
  }]);

  maria.directive('task', [function () {
    return {
      restrict: 'E',
      templateUrl: './templates/task.html'
    };
  }]);

  maria.directive('collapseWatcher', [function () {
    return {
      restrict: 'A',
      scope: { collapseWatcher: '=' },
      link: function (scope, element, attrs) {
        element.bind('click', function(event) {
          var
            rootScope = scope.$parent.$parent,
            system = scope.collapseWatcher,
            was_open = element.next().hasClass('in');
            systems = rootScope.systems.local,
            s = systems.length;

          while (--s >= 0) { systems[s].opened = false; }
          system.opened = !was_open;
          scope.$apply();

          if (!was_open && !system.tasks) rootScope.getTasks(system);
        });
      }
    };
  }]);


  // -------------------------------------------------------------------------------------------
  // FILTERS
  // -------------------------------------------------------------------------------------------

  maria.filter('datetime', function() {
    return function (date) {
      function foo (value) { return value <= 9 ? '0' + value : '' + value; };
      function isValidDate (date) {
        if (Object.prototype.toString.call(date) !== "[object Date]") return false;
        return !isNaN(date.getTime());
      }

      if (!isValidDate(date)) return 'пусто';
      var
        result = '',
        minute = date.getMinutes(),
        hour = date.getHours(),
        day = date.getDate(),
        month = date.getMonth() + 1,
        year = date.getFullYear();
      result += foo(day) + '.' + foo(month) + '.' + foo(year);
      if (minute || hour) { result += ', ' + foo(hour) + ':' + foo(minute); };
      return result;
    };
  });

  maria.filter('estdatetime', function() {
    return function (date) {
      
      function isValidDate (date) {
        if (Object.prototype.toString.call(date) !== "[object Date]") return false;
        return !isNaN(date.getTime());
      };

      function calcBusinessDays(dDate1, dDate2) { // input given as Date objects
        var iWeeks, iDateDiff, iAdjust = 0;
         
        if (dDate2 < dDate1) return -calcBusinessDays(dDate2, dDate1); // error code if dates transposed
         
        var iWeekday1 = dDate1.getDay(); // day of week
        var iWeekday2 = dDate2.getDay();
         
        iWeekday1 = (iWeekday1 == 0) ? 7 : iWeekday1; // change Sunday from 0 to 7
        iWeekday2 = (iWeekday2 == 0) ? 7 : iWeekday2;
         
        if ((iWeekday1 > 5) && (iWeekday2 > 5)) iAdjust = 1; // adjustment if both days on weekend
         
        iWeekday1 = (iWeekday1 > 5) ? 5 : iWeekday1; // only count weekdays
        iWeekday2 = (iWeekday2 > 5) ? 5 : iWeekday2;
         
        // calculate differnece in weeks (1000mS * 60sec * 60min * 24hrs * 7 days = 604800000)
        iWeeks = Math.floor((dDate2.getTime() - dDate1.getTime()) / 604800000)
         
        if (iWeekday1 <= iWeekday2) {
          iDateDiff = (iWeeks * 5) + (iWeekday2 - iWeekday1)
        } else {
          iDateDiff = ((iWeeks + 1) * 5) - (iWeekday1 - iWeekday2)
        }
         
        iDateDiff -= iAdjust // take into account both days on weekend
         
        return (iDateDiff + 1); // add 1 because dates are inclusive
       
      };


      if (!isValidDate(date)) return '';

      var
        now = new Date(),
        days = calcBusinessDays(now, date);

      return days;
    };
  });

})();
