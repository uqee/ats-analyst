(function(){
  'use strict';
  var FILTER = {
    type: [4, 6, 14, 19, 29],
    status: [1, 3, 4, 5,
      10000, 10001,        10003, 10004, 10005,        10007,
      10010, 10011, 10012,        10014, 10015,        10017, 10018, 10019,
      10020, 10021, 10022, 10023, 10024, 10025, 10026, 10027, 10028, 10029,
      10030, 10031, 10032, 10033, 10034, 10035, 10036, 10037, 10038, 10039,
      10040, 10041, 10042, 10043, 10044, 10045, 10046, 10047, 10048, 10049,
      10050, 10051, 10052]
  };

  angular.module('JiraModule', []).provider('jiraService', function() {
    var self = this;

    // configuration
    self.setBaseUrl = function(base_url) {
      self.base_url = base_url;
      self.projects_url = base_url + '/secure/BrowseProjects.jspa';
      self.search_url = base_url + '/sr/jira.issueviews:searchrequest-xml/temp/SearchRequest.xml';
      self.issue_url = base_url + '/si/jira.issueviews:issue-xml';
      self.profile_url = base_url + '/secure/ViewProfile.jspa';
    };
    //self.setBaseUrl('http://jira');

    // behaviour
    self.$get = ['$http', function($http) {

      function getHtml (url) {
        return $http
          .get(url, { withCredentials: true })
          .then(function(result) {
            return $.parseHTML(result.data.replace(/<img[^>]*>/g, ''));
        });
      };

      function getXml (url, params) {
        if (params === undefined) params = {};
        return $http({
          method: 'GET',
          url: url,
          params: params,
          withCredentials: true
        }).then(function(result) {
          return $.parseXML(result.data);
        });
      };

      function getUser () {
        return browseProjects.then( function (html) {
          return $(html).find('#account-options li:nth-child(1) a').text();
        });
      };

      function getSystems () {
        return browseProjects.then( function (html) {
          var
            systems = [],
            tbodies = [],
            category = '',
            td1 = {},
            td2 = {},
            trs = [];
          
          // iterate over tables
          tbodies = $(html).find('tbody tr td b:contains(Руководитель проекта)').parent().parent().parent();
          $.each(tbodies, function(index, tbody) {

            // get category name from header
            category = $(tbody).find('h3.formtitle').text().substr(12) || 'Без категории';

            // iterate over rows
            trs = $(tbody).find('tr[bgcolor="ffffff"]');
            $.each(trs, function(index, row) {

              // fuck jira
              td1 = $(row).find('td:nth-child(1) a')[0];
              td2 = $(row).find('td:nth-child(2)')[0];

              // add founded system
              systems.push({
                category: category,
                name: $(td1).text(),
                url: $(td1).attr('href'),
                code: $(td2).text().trim()
              });
            });
          });

          // whoa!
          return systems;
        });
      };

      function getPid (url) {
        return getHtml(self.base_url + url).then(function(html) {
          return $(html).find('#create_issue_for_project').attr('href').split('?pid=')[1];
        });
      };

      function getTasks (pid) {
        return getXml(self.search_url, {
          pid: pid,
          type: FILTER.type,
          status: FILTER.status
        }).then(parseXmlTasks);
      };

      function getTask (code) {
        return getXml(self.issue_url + '/' + code + '/'/* + code + '.xml'*/)
          .then(parseXmlTasks).then(function (tasks) { return tasks[0]; });
      };

      function parseXmlTasks (xml) {

        function foo (root, elem_name) {
          var elem = $(root).children(elem_name)[0];
          return $(elem).text();
        };

        function bar (customfields, elem_id) {
          var
            customfield = customfields.children('customfield[id="customfield_' + elem_id + '"]')[0],
            customfieldvalues = $(customfield).children('customfieldvalues')[0],
            customfieldvalue = $(customfieldvalues).children('customfieldvalue')[0];
          return $(customfieldvalue).text();
        };

        var
          tasks = [],
          tasks_xml = $(xml).find('item'),
          t = tasks_xml.length,
          task_xml, comments, customfields, last_comment, task;

        while (--t >= 0) {
          task_xml = $(tasks_xml[t]);
          comments = $(task_xml.children('comments')[0]);
          customfields = $(task_xml.children('customfields')[0]);
          last_comment = $(comments.children('comment')[0]);
          task = {
            url: foo(task_xml, 'link'),
            code: foo(task_xml, 'key'),
            name: foo(task_xml, 'title'),
            description: foo(task_xml, 'description'),
            status: foo(task_xml, 'status'),
            assignee: foo(task_xml, 'assignee'),
            updated: foo(task_xml, 'updated'),
            last_comment: {
              text: last_comment.text(),
              date: new Date(last_comment.attr('created')),
              author: last_comment.attr('author'),
            },
            analyst_starts: bar(customfields, 10363),
            analyst_ends: bar(customfields, 10002),
            analyst_comment: bar(customfields, 10195),
            dev_starts: bar(customfields, 10362)
          };
          task.name = task.name.substr(task.name.indexOf('] ') + 2);
          task.updated = new Date(task.updated);
          task.analyst_starts = new Date(task.analyst_starts);
          task.analyst_ends = new Date(task.analyst_ends);
          task.dev_starts = new Date(task.dev_starts);
          task.last_comment.author_url = self.profile_url + '?name=' + task.last_comment.author;
          tasks.push(task);
        };

        return tasks;
      };

      var browseProjects = getHtml(self.projects_url);

      return {
        getUser: getUser,
        getSystems: getSystems,
        getPid: getPid,
        getTasks: getTasks,
        getTask: getTask
      };
    }];
  });
})();
