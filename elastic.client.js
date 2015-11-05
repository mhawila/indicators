module.exports = (function(){
    'use strict';
    var elastic = require('elasticsearch');
    
    // Get elastic configuration.
    var settings = require('./elastic.conf.json');
    
    return new elastic.Client({
        host: settings.host,
        log: settings.log_level
    });
})();
