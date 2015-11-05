(function(){
    'use strict';
    
    var hapi = require('hapi');
    var good = require('good');
    var fs = require('fs');
    var routes = require('./routes/care.treatment.routes.js');
    var configs = require('./server.conf.json');
    
    var server = new hapi.Server();

    server.connection({
        host: configs.host,
        port: configs.port
    });
    
    // Register other routes
    for(var route of routes) {
        // console.log(route);
        server.route(route);
    }
    
    server.register({
        register: good,
        options: {
            reporters: [{
                reporter: require('good-console'),
                events: {
                    response: '*',
                    log: '*'
                }
            }]
        }
    }, function(err) {
        if(err) {
            throw err;
        }
    });
    
    server.start(function(){
        console.log('server running at ', server.info.uri, ' ...');
    });
})();
