﻿define('datacontext', 
    ['jquery', 'underscore', 'ko', 'model', 'model.mapper', 'dataservice', 'config', 'utils', 'presenter'],
    function ($, _, ko, model, modelmapper, dataservice, config, utils, presenter) {
        var logger = config.logger,
            itemsToArray = function(items, observableArray, filter, sortFunction) {
                // Maps the memo to an observableArray, 
                // then returns the observableArray
                if (!observableArray) return;

                // Create an array from the memo object
                var underlyingArray = utils.mapMemoToArray(items);

                if (filter) {
                    underlyingArray = _.filter(underlyingArray, function(o) {
                        var match = filter.predicate(filter, o);
                        return match;
                    });
                }
                if (sortFunction) {
                    underlyingArray.sort(sortFunction);
                }
                //logger.info('Fetched, filtered and sorted ' + underlyingArray.length + ' records');
                observableArray(underlyingArray);
            },
            mapToContext = function(dtoList, items, results, mapper, filter, sortFunction) {
                // Loop through the raw dto list and populate a dictionary of the items
                items = _.reduce(dtoList, function(memo, dto) {
                    var id = mapper.getDtoId(dto);
                    var existingItem = items[id];
                    memo[id] = mapper.fromDto(dto, existingItem);
                    return memo;
                }, { });
                itemsToArray(items, results, filter, sortFunction);
                //logger.success('received with ' + dtoList.length + ' elements');
                return items; // must return these
            },
            EntitySet = function(getFunction, mapper, nullo, updateFunction) {
                var items = { },
                    // returns the model item produced by merging dto into context
                    mapDtoToContext = function(dto) {
                        var id = mapper.getDtoId(dto);
                        var existingItem = items[id];
                        items[id] = mapper.fromDto(dto, existingItem);
                        return items[id];
                    },
                    add = function(newObj) {
                        items[newObj.id()] = newObj;
                    },
                    removeById = function(id) {
                        delete items[id];
                    },
                    getLocalById = function(id) {
                        // This is the only place we set to NULLO
                        return !!id && !!items[id] ? items[id] : nullo;
                    },
                    getAllLocal = function() {
                        return utils.mapMemoToArray(items);
                    },
                    getData = function(options) {
                        presenter.toggleActivity(true);
                        return $.Deferred(function(def) {
                            var results = options && options.results,
                                sortFunction = options && options.sortFunction,
                                filter = options && options.filter,
                                forceRefresh = options && options.forceRefresh,
                                param = options && options.param,
                                getFunctionOverride = options && options.getFunctionOverride;

                            getFunction = getFunctionOverride || getFunction;

                            // If the internal items object doesnt exist, 
                            // or it exists but has no properties, 
                            // or we force a refresh
                            if (forceRefresh || !items || !utils.hasProperties(items)) {
                                getFunction({
                                    success: function(dtoList) {
                                        items = mapToContext(dtoList, items, results, mapper, filter, sortFunction);
                                        def.resolve(results);
                                    },
                                    error: function(response) {
                                        logger.error(config.toasts.errorGettingData);
                                        def.reject();
                                    }
                                }, param);
                            } else {
                                itemsToArray(items, results, filter, sortFunction);
                                def.resolve(results);
                            }
                            def.always(function() {
                                presenter.toggleActivity(false);
                            });
                        }).promise();
                    },
                    updateData = function(entity, callbacks) {

                        var entityJson = ko.toJSON(entity);

                        return $.Deferred(function(def) {
                            if (!updateFunction) {
                                logger.error('updateData method not implemented');
                                if (callbacks && callbacks.error) {
                                    callbacks.error();
                                }
                                def.reject();
                                return;
                            }

                            updateFunction({
                                success: function(response) {
                                    logger.success(config.toasts.savedData);
                                    entity.dirtyFlag().reset();
                                    if (callbacks && callbacks.success) {
                                        callbacks.success();
                                    }
                                    def.resolve(response);
                                },
                                error: function(response) {
                                    logger.error(config.toasts.errorSavingData);
                                    logger.error(response);
                                    if (callbacks && callbacks.error) {
                                        callbacks.error();
                                    }
                                    def.reject(response);
                                    return;
                                }
                            }, entityJson);
                        }).promise();
                    };

                return {
                    mapDtoToContext: mapDtoToContext,
                    add: add,
                    getAllLocal: getAllLocal,
                    getLocalById: getLocalById,
                    getData: getData,
                    removeById: removeById,
                    updateData: updateData
                };
            },
            //----------------------------------
            // Repositories
            //
            // Pass: 
            //  dataservice's 'get' method
            //  model mapper
            //----------------------------------
            dashboards = new EntitySet(dataservice.dashboard.getDashboards, modelmapper.dashboard, model.Dashboard.Nullo),
            widgets = new EntitySet(dataservice.widget.getWidgets, modelmapper.column, model.Widget.Nullo, dataservice.widget.updateWidget);

        dashboards.addData = function(dashboardModel, callbacks) {
            var dashboardModelJson = ko.toJSON(dashboardModel);

            return $.Deferred(function(def) {
                dataservice.dashboard.addDashboard({
                    success: function(dto) {
                        if (!dto) {
                            logger.error(config.toasts.errorSavingData);
                            if (callbacks && callbacks.error) {
                                callbacks.error();
                            }
                            def.reject();
                            return;
                        }
                        var newDashboard = modelmapper.dashboard.fromDto(dto); // Map DTO to Model
                        dashboards.add(newDashboard); // Add to the datacontext
                        logger.success(config.toasts.savedData);
                        if (callbacks && callbacks.success) {
                            callbacks.success(newDashboard);
                        }
                        def.resolve(dto);
                    },
                    error: function(response) {
                        logger.error(config.toasts.errorSavingData);
                        if (callbacks && callbacks.error) {
                            callbacks.error();
                        }
                        def.reject(response);
                        return;
                    }
                }, dashboardModelJson);
            }).promise();
        };
        
        dashboards.deleteData = function (dashboardId, callbacks) {
            return $.Deferred(function (def) {
                dataservice.dashboard.deleteDashboard({
                    success: function (response) {
                        dashboards.removeById(dashboardId);
                        logger.success(config.toasts.savedData);
                        if (callbacks && callbacks.success) { callbacks.success(); }
                        def.resolve(response);
                    },
                    error: function (response) {
                        logger.error(config.toasts.errorSavingData);
                        if (callbacks && callbacks.error) { callbacks.error(); }
                        def.reject(response);
                        return;
                    }
                }, dashboardId);
            }).promise();
        };
        
        widgets.addData = function (widgetModel, callbacks) {
            var widgetModelJson = ko.toJSON(widgetModel);

            return $.Deferred(function (def) {
                dataservice.widget.addWidget({
                    success: function (dto) {
                        if (!dto) {
                            logger.error(config.toasts.errorSavingData);
                            if (callbacks && callbacks.error) {
                                callbacks.error();
                            }
                            def.reject();
                            return;
                        }
                        var newWidget = modelmapper.widget.fromDto(dto); // Map DTO to Model
                        widgets.add(newWidget); // Add to the datacontext
                        logger.success(config.toasts.savedData);
                        if (callbacks && callbacks.success) {
                            callbacks.success(newDashboard);
                        }
                        def.resolve(dto);
                    },
                    error: function (response) {
                        logger.error(config.toasts.errorSavingData);
                        if (callbacks && callbacks.error) {
                            callbacks.error();
                        }
                        def.reject(response);
                        return;
                    }
                }, widgetModelJson);
            }).promise();
        };
        
        widgets.deleteData = function (widgetModel, callbacks) {
            return $.Deferred(function (def) {
                dataservice.widget.deleteWidget({
                    success: function (response) {
                        widgets.removeById(widgetModel.id());
                        logger.success(config.toasts.savedData);
                        if (callbacks && callbacks.success) { callbacks.success(); }
                        def.resolve(response);
                    },
                    error: function (response) {
                        logger.error(config.toasts.errorSavingData);
                        if (callbacks && callbacks.error) { callbacks.error(); }
                        def.reject(response);
                        return;
                    }
                }, widgetModel.id());
            }).promise();
        };

        var datacontext = {
            dashboards: dashboards,
            widgets: widgets
        };
        
        // We did this so we can access the datacontext during its construction
        model.setDataContext(datacontext);

        return datacontext;
});