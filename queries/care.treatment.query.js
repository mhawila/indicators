module.exports = (function(){
    'use strict';
    
    // Create a query to fetch all documents with patients enrolled in care.
    var ADULTINIT = 1;
    var ADULTRET = 2;
    var PEADINIT = 3;
    var PEADRET = 4;
    var index = 'amrs';
    var type = 'obs'; 
    
    var _ = require('lodash');
    
    /**
     * Function enrolledInCareQuery
     * Possible params properties are 
     * 1. location (can be an array), 
     * 2. startDate,
     * 3. endDate
     * 4. lowerAgeLimit
     * 5. upperAgeLimit
     * 6. gender
     * 7. index
     * 8. type
     * startDate & endDate define reporting period.
     * lowerAgeLimit & upperAgeLimit define age group inclusively
     * location currently expects ids.
     */   
    function enrolledInCareQuery(params) {
        params = params || {};
        var query = {
            index: params['index'] || index,
            type: params['type'] || type,
            body: {
                'aggs': {
                    'enrolled': {
                        'filter': {
                            'bool': {
                                'must':[{
                                    'terms': {
                                        'encounter_type': [
                                            ADULTINIT,
                                            PEADINIT,
                                        ]
                                    }
                                }, {
                                    'term': {
                                        'voided':false
                                    }
                                }]
                            }
                        },
                        'aggs': {
                            'patients': {
                                'terms':{
                                    'field':'person_uuid',
                                    'size': 0
                                }
                            }
                        } 
                    }
                }
            },
            size: 0
        };
        
        if(!_.isEmpty(params)) {
            var conditions = query.body.aggs.enrolled.filter.bool.must;
            
            _handleAgeCondition(params, conditions);
            _handlePeriodCondition(params,conditions);
            _handleLocationCondition(params, conditions);
            
            //Deal with gender.
            if(params.gender) {
                var gender = {
                    'term':{
                        'gender':params.gender
                    }
                };
                conditions.push(gender);
            }
        }
        return query;   
    }
    
    /**
     * Function activeInCareQuery
     * Possible params properties are 
     * 1. location (can be an array), 
     * 2. startDate,
     * 3. endDate
     * 4. lowerAgeLimit
     * 5. upperAgeLimit
     * 6. gender
     * 7. index
     * 8. type
     * startDate & endDate define reporting period.
     * lowerAgeLimit & upperAgeLimit define age group inclusively
     * location currently expects ids.
     */   
    function activeInCareQuery(params) {
        params = params || {};
        var query = {
            index: params['index'] || index,
            type: params['type'] || type,
            body: {
                'aggs': {
                    'active': {
                        'filter': {
                            'bool': {
                                'must':[{
                                    'terms': {
                                        'encounter_type': [
                                            ADULTINIT,
                                            ADULTRET,
                                            PEADINIT,
                                            PEADRET
                                        ]
                                    }
                                },{
                                    'term': {
                                        'voided': false
                                    }
                                }]
                            }
                        },
                        'aggs': {
                            'patients': {
                                'terms':{
                                    'field':'person_uuid',
                                    'size': 0
                                }
                            }
                        } 
                    }
                },
                size: 0
            }    
        };
        
        if(!_.isEmpty(params)) {
            var conditions = query.body.aggs.active.filter.bool.must;
            _handleAgeCondition(params, conditions);
            _handleLocationCondition(params, conditions);
            
            //Deal with gender.
            if(params.gender) {
                var gender = {
                    'term':{
                        'gender':params.gender
                    }
                };
                conditions.push(gender);
            }
            
            var period = {
                range: {
                    'obs_datetime':{
                        'gte':'now-3m',
                        'lte': 'now'
                    }
                }
            };
            
            if(params.endDate) {
                period.range.obs_datetime.gte = params.endDate + '||-3M';
                period.range.obs_datetime.lte = params.endDate;
            }
            
            //Add the period
            conditions.push(period);
        }
        return query;   
    }
    
    function transferOutQuery(params) {
        var params = params || {};
        
        var query = {
            index: params['index'] || index,
            type: params['type'] || type,
            body: {
                'aggs': {
                    'transferOut': {
                        'filter': {
                             'bool': {
                                 'must': [
                                    {'bool': {
                                        'should': [
                                         {
                                              'bool': {
                                                  'must': [{
                                                        'term': {
                                                            'concept_id': 1946
                                                        }
                                                     },{
                                                         'terms': {
                                                            'value_coded': [1065]
                                                            }
                                                     }
                                                  ]
                                             }
                                      },
                                      {
                                          'terms': {
                                             'concept_id': [1596,1285]
                                          }
                                      }
                                   ]    
                               }}
                            ]}
                         },
                        'aggs': {
                            'patients': {
                                'terms':{
                                    'field':'person_id',
                                    'size': 0
                                }
                            }
                        }
                    }
                },
                'size': 0
            }
        };
        
        if(!_.isEmpty(params)) {
            var conditions = query.body.aggs.transferOut.filter.bool.must;
            
            _handleAgeCondition(params, conditions);
            _handleLocationCondition(params, conditions);
            _handlePeriodCondition(params, conditions);
            
            //Deal with gender.
            if(params.gender) {
                var gender = {
                    'term':{
                        'gender':params.gender
                    }
                };
                conditions.push(gender);
            }
        }
        return query;                          
    }
    
    function _handlePeriodCondition(params, conditionsArray) {
        var includeCondition = false;
        var period = {
            range: {
                'obs_datetime':{
                }
            }
        };
        
        if(params.startDate) {
            period.range.obs_datetime.gte = params.startDate;
            includeCondition = true;
        }
        
        if(params.endDate) {
            period.range.obs_datetime.lte = params.endDate;
            includeCondition = true;
        }
        
        if(includeCondition) {
            conditionsArray.push(period);
        }
    }
    
    function _handleAgeCondition(params, conditionsArray) {
        var age = {
            'range': {
                'birthdate': {
                }
            }
        };
        var includeCondition = false;
        
        if(params.lowerAgeLimit) {
            if(params.endDate) {
                age.range.birthdate.lte = params.endDate + '||-' + params.lowerAgeLimit + 'y';
            } else {
                age.range.birthdate.lte = 'now-' + params.lowerAgeLimit + 'y';
            }
            includeCondition = true;
        } 
        
        if(params.upperAgeLimit) {
            if(params.endDate) {
                age.range.birthdate.gte = params.endDate + '||-' + params.upperAgeLimit + 'y';
            } else {
                age.range.birthdate.gte = 'now-' + params.upperAgeLimit + 'y';
            }
            includeCondition = true;
        }
        
        if(includeCondition) {
            conditionsArray.push(age);
        }
    }
    
    function _handleLocationCondition(params, conditionsArray) {
        if(params.location) {
            var location = {
                terms:{'location_id': []}
            };
            if(typeof params.location === 'array') {
                for(var loc of params.location) {
                    location.terms.location_id.push(loc);
                }
            } else {
                location.terms.location_id.push(params.location);
            }
            conditionsArray.push(location);
        }
    }
    
    return {
        enrolledInCareQuery: enrolledInCareQuery,
        activeInCareQuery: activeInCareQuery,
        transferOutQuery: transferOutQuery
    };
})();
