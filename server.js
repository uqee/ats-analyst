/* Created by Denis Zhbankov at 14.03.2014 */
var connect = require('connect');
connect.createServer(
    connect.static(__dirname)
).listen(8080);
console.log('Server running at http://localhost:8080/');
console.log('To exit press Ctrl+C twice.');
