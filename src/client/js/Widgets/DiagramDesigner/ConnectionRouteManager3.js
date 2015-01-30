/*globals define, _*/

define(['logManager', 
        './AutoRouter', 
        './ConnectionRouteManager3.ActionApplier.js', 
        'util/assert', 
        './Profiler'], function (logManager, 
                                 AutoRouter, 
                                 ActionApplier, 
                                 assert, 
                                 Profiler) {

    "use strict";

    var ConnectionRouteManager3,
        DESIGNERITEM_SUBCOMPONENT_SEPARATOR = '_x_',
        DEBUG = true;

    ConnectionRouteManager3 = function (options) {
        this.logger = (options && options.logger) || logManager.create(((options && options.loggerName) || "ConnectionRouteManager3"));

        this.diagramDesigner = options ? options.diagramDesigner : null;

        if (this.diagramDesigner === undefined || this.diagramDesigner === null) {
            this.logger.error("Trying to initialize a ConnectionRouteManager3 without a canvas...");
            throw ("ConnectionRouteManager3 can not be created");
        }

        this.logger.debug("ConnectionRouteManager3 ctor finished");
        this._portSeparator = DESIGNERITEM_SUBCOMPONENT_SEPARATOR;

        if (DEBUG) {
            this._recordActions = true;
        }
        ActionApplier.prototype.init.call(this);
    };

    ConnectionRouteManager3.prototype.initialize = function () {
        this._clearGraph();

        //Adding event listeners
        var self = this;

        this._onComponentUpdate = function(_canvas, ID) {
            if( self.diagramDesigner.itemIds.indexOf( ID ) !== -1 ) {
                if( self.diagramDesigner.items[ID].rotation !== self._autorouterBoxRotation[ID] ) { //Item has been rotated
                    self._resizeItem( ID );
                }
            }
       };
        this.diagramDesigner.addEventListener(this.diagramDesigner.events.ON_COMPONENT_UPDATE, this._onComponentUpdate);

        this._onComponentCreate = function(_canvas, ID) {
            if(self.diagramDesigner.itemIds.indexOf( ID ) !== -1 && self._autorouterBoxes[ID] === undefined) {
                self.insertBox( ID );
            } else if( self.diagramDesigner.connectionIds.indexOf( ID ) !== -1 ) {
                self.insertConnection( ID );
            }
        };
        this.diagramDesigner.addEventListener(this.diagramDesigner.events.ON_COMPONENT_CREATE, this._onComponentCreate);

        this._onComponentResize = function(_canvas, ID) {
            if(self._autorouterBoxes[ID.ID]) {
                self._resizeItem( ID.ID );
            } else {
                self.insertBox( ID.ID );
            }
        };
        this.diagramDesigner.addEventListener(this.diagramDesigner.events.ITEM_SIZE_CHANGED, this._onComponentResize);

        this._onComponentDelete = function(_canvas, ID) {//Boxes and lines
            self.deleteItem( ID );
        };
        this.diagramDesigner.addEventListener(this.diagramDesigner.events.ON_COMPONENT_DELETE, this._onComponentDelete);
        //ON_UNREGISTER_SUBCOMPONENT

        this._onItemPositionChanged = function(_canvas, eventArgs) {
            if(self._autorouterBoxes[eventArgs.ID]) {
                var x = self.diagramDesigner.items[eventArgs.ID].getBoundingBox().x,
                    y = self.diagramDesigner.items[eventArgs.ID].getBoundingBox().y;

                self._invokeAutoRouterMethod('move', [eventArgs.ID, {x: x, y: y}]);
            }
        };
        this.diagramDesigner.addEventListener(this.diagramDesigner.events.ITEM_POSITION_CHANGED, this._onItemPositionChanged);

        this._onClear = function(_canvas, eventArgs) {
            self._clearGraph();
        };
        this.diagramDesigner.addEventListener(this.diagramDesigner.events.ON_CLEAR, this._onClear);

        this._onUnregisterSubcomponent = function(sender, ids) {
            var longid = ids.objectID + DESIGNERITEM_SUBCOMPONENT_SEPARATOR + ids.subComponentID;
                if(self._autorouterBoxes[longid]) {
                    self.deleteItem(longid);
                }
        };
        this.diagramDesigner.addEventListener(this.diagramDesigner.events.ON_UNREGISTER_SUBCOMPONENT, this._onUnregisterSubcomponent);
    };

    ConnectionRouteManager3.prototype.destroy = function () {
        //removeEventListener(eventName, handler);
        this.diagramDesigner.removeEventListener(this.diagramDesigner.events.ON_COMPONENT_CREATE, this._onComponentCreate);
        this.diagramDesigner.removeEventListener(this.diagramDesigner.events.ON_COMPONENT_UPDATE, this._onComponentUpdate);
        this.diagramDesigner.removeEventListener(this.diagramDesigner.events.ITEM_SIZE_CHANGED, this._onComponentResize);
        this.diagramDesigner.removeEventListener(this.diagramDesigner.events.ON_COMPONENT_DELETE, this._onComponentDelete);
        this.diagramDesigner.removeEventListener(this.diagramDesigner.events.ITEM_POSITION_CHANGED, this._onItemPositionChanged);
        this.diagramDesigner.removeEventListener(this.diagramDesigner.events.ON_CLEAR, this._onClear);
        this.diagramDesigner.removeEventListener(this.diagramDesigner.events.ON_UNREGISTER_SUBCOMPONENT, this._onUnregisterSubcomponent);
    };

    ConnectionRouteManager3.prototype.redrawConnections = function (idList) {

        if( !this._initialized ) {
            this._initializeGraph();
        }else{
            this._refreshConnData(idList);
        }

        //no matter what, we want the id's of all the connections
        //not just the ones that explicitly needs rerouting
        idList = this.diagramDesigner.connectionIds.slice(0);

        //1 - autoroute
        this._invokeAutoRouterMethod('routeSync', []);

        //2 - Get the path points and redraw
        var pathPoints,
            realPathPoints;

        for (var i = 0; i < idList.length; i ++) {
            if(this._autorouterPaths[idList[i]]) {
                pathPoints = this._invokeAutoRouterMethod('getPathPoints', [idList[i]]);
            } else {
                pathPoints = [];
            }

            realPathPoints = [];
            for(var j = 0; j < pathPoints.length; j++) {
                realPathPoints.push({'x': pathPoints[j][0], 'y': pathPoints[j][1] });
            }

            this.diagramDesigner.items[idList[i]].setConnectionRenderData(realPathPoints);
        }

        //need to return the IDs of the connections that was really
        //redrawn or any other visual property changed (width, etc)

        return idList;
    };

    ConnectionRouteManager3.prototype._refreshConnData = function (idList) {
        //Clear connection data and paths then re-add them
        var i = idList.length;

        while(i--) {
            this.deleteItem(idList[i]);
            this.insertConnection([idList[i]]);
        }

    };

    ConnectionRouteManager3.prototype._clearGraph = function () {
        this._invokeAutoRouterMethod('clear', []);
        this._autorouterBoxRotation = {};//Define container that will map obj+subID -> rotation
        this._clearRecords();
        this.endpointConnectionAreaInfo = {};
        this.initialized = false;
    };

    ConnectionRouteManager3.prototype._initializeGraph = function () {
        /*
         * In this method, we will update the boxes using the canvas.itemIds list and
         * add any ports as needed (from the canvas.connectionIds)
         */
        var canvas = this.diagramDesigner,
            connIdList = canvas.connectionIds,
            itemIdList = canvas.itemIds,
            i = itemIdList.length,
            connId,
            srcObjId,
            srcSubCompId,
            dstObjId,
            dstSubCompId;

        while(i--) {
            this.insertBox(itemIdList[i]);
        }

        i = connIdList.length;
        while( i-- ) {
            this.insertConnection(connIdList[i]);
        }

        this._initialized = true;

    };

    ConnectionRouteManager3.prototype.insertConnection = function (connId) {
        var canvas = this.diagramDesigner,
            srcObjId = canvas.connectionEndIDs[connId].srcObjId,
            srcSubCompId = canvas.connectionEndIDs[connId].srcSubCompId,
            dstObjId = canvas.connectionEndIDs[connId].dstObjId,
            dstSubCompId = canvas.connectionEndIDs[connId].dstSubCompId,
            sId = srcSubCompId ? srcObjId + DESIGNERITEM_SUBCOMPONENT_SEPARATOR + srcSubCompId : srcObjId,
            tId = dstSubCompId ? dstObjId + DESIGNERITEM_SUBCOMPONENT_SEPARATOR + dstSubCompId : dstObjId,
            connMetaInfo = canvas.items[connId].getMetaInfo(),
            srcConnAreas = canvas.items[srcObjId].getConnectionAreas(srcSubCompId, false, connMetaInfo),
            dstConnAreas = canvas.items[dstObjId].getConnectionAreas(dstSubCompId, true, connMetaInfo),
            srcPorts = {},
            dstPorts = {},
            portId,
            j;

        this._updatePort(srcObjId, srcSubCompId);//Adding ports for connection
        this._updatePort(dstObjId, dstSubCompId);

        //Get available ports for this connection
        j = srcConnAreas.length;
        while(j--) {
            srcPorts[srcConnAreas[j].id] = sId;
        }
        
        j = dstConnAreas.length;
        while(j--) {
            dstPorts[dstConnAreas[j].id] = tId;
        }

        //If it has both a src and dst
        if(this._autorouterBoxes[sId].ports.length !== 0 && this._autorouterBoxes[tId].ports.length !== 0) {
            this._invokeAutoRouterMethod('addPath', 
                [{src: srcPorts, dst: dstPorts}, connId]);
        }

        //Set custom points, if applicable
        if(canvas.items[connId].segmentPoints.length > 0) {
            this._invokeAutoRouterMethod('setPathCustomPoints', 
                [{"path": connId, "points": canvas.items[connId].segmentPoints}]);
        }

     };

    ConnectionRouteManager3.prototype.insertBox = function (objId) {
        var canvas = this.diagramDesigner,
            designerItem,
            areas, 
            bBox,
            boxdefinition,
            isEnd,
            j = 0;

        designerItem = canvas.items[objId];
        bBox = designerItem.getBoundingBox();
        areas = designerItem.getConnectionAreas(objId, isEnd) || [];

        boxdefinition = {
            //BOX
            "x1": bBox.x,
            "y1": bBox.y,
            "x2": bBox.x2,
            "y2": bBox.y2,

            //PORTS
            "ports": []
        };

        while (j < areas.length) {
            //Building up the ports object
            boxdefinition.ports.push({ 'id': areas[j].id, 'area': [ [ areas[j].x1, areas[j].y1 ], [ areas[j].x2, areas[j].y2 ] ], 
                    'angles': [ areas[j].angle1, areas[j].angle2 ] });
            j++;
        }

        this._invokeAutoRouterMethod('addBox', [boxdefinition, objId]);
        this._autorouterBoxRotation[objId] = canvas.items[objId].rotation;
    };

    ConnectionRouteManager3.prototype.deleteItem = function (objId) {
        //If I can query them from the objId, I can clear the entries with that info
        this._invokeAutoRouterMethod('remove', [objId]);

    };

    ConnectionRouteManager3.prototype._resizeItem = function (objId) {
        var canvas = this.diagramDesigner,
            isEnd = true, 
            connectionMetaInfo,
            designerItem = canvas.items[objId],
            newCoord = designerItem.getBoundingBox(),
            newBox = { 'x1': newCoord.x, 
                       'x2': newCoord.x2, 
                       'y1': newCoord.y, 
                       'y2': newCoord.y2,
          'ports': [] },
            connAreas = designerItem.getConnectionAreas(objId, isEnd, connectionMetaInfo),
            i;

        //Create the new box connection areas
        i = connAreas.length;
        while (i--) {
            //Building up the ConnectionAreas obiect
            newBox.ports.push({'id': connAreas[i].id, 
                               'area': [ [ connAreas[i].x1, connAreas[i].y1 ], [ connAreas[i].x2, connAreas[i].y2 ] ],
                               'angles': [connAreas[i].angle1, connAreas[i].angle2]});
        }

        //Update Box 
        this._invokeAutoRouterMethod('setBoxRect',[objId, newBox]);

    };

    ConnectionRouteManager3.prototype._updatePort = function (objId, subCompId) {
        var longid = objId + DESIGNERITEM_SUBCOMPONENT_SEPARATOR + subCompId,
            canvas = this.diagramDesigner,
            connectionMetaInfo = null;

        if (subCompId !== undefined) { //Updating a port
            //We need to know if the box even exists...
            if(!this._autorouterBoxes[longid]) { //If the port doesn't exist, create it
                this._createPort(objId, subCompId);
            } else{
                //TODO Adjust size, connection info
                var newBox = this._createPortInfo(objId, subCompId);
                this._invokeAutoRouterMethod('setBoxRect',[longid, newBox]);
            }
        } else { // Updating the box's connection areas
            var areas = canvas.items[objId].getConnectionAreas() || [],
                newIds = {},
                connInfo = [],
                boxObject = this._autorouterBoxes[objId],
                id,
                j;

            for (j = areas.length; j--;) {
                //Building up the ports object
                connInfo.push({ 'id': areas[j].id, 'area': [ [ areas[j].x1, areas[j].y1 ], [ areas[j].x2, areas[j].y2 ] ],
                                'angles': [ areas[j].angle1, areas[j].angle2 ] });
                newIds[areas[j].id] = true;
            }

            // Update each AutoRouter port
            for (j = connInfo.length; j--;) {
                this._invokeAutoRouterMethod('updatePort',[objId, connInfo[j]]);
            }

            for (j = boxObject.ports.length; j--;) {
                id = boxObject.ports[j].id;
                if (!newIds[id]) {
                    this._invokeAutoRouterMethod('removePort',[boxObject.ports[j]]);  // Not sure FIXME
                }
            }
        }
     };

    ConnectionRouteManager3.prototype._createPort = function (objId, subCompId) {
        var longid = objId + DESIGNERITEM_SUBCOMPONENT_SEPARATOR + subCompId,
            newBox = this._createPortInfo(objId, subCompId);

        this._invokeAutoRouterMethod('addBox', [newBox, longid]);
        this._invokeAutoRouterMethod('setComponent',[objId, longid]);
    };

    ConnectionRouteManager3.prototype._createPortInfo = function (objId, subCompId) {
        //Ports will now be a subcomponent
        //We will do the following: 
        //  - Create a box for the port
        //      - Determine the connection areas
        //      - Determine the box
        //          - Use the connection angle
        //  - Set the box as a component of the parent
        var longid = objId + DESIGNERITEM_SUBCOMPONENT_SEPARATOR + subCompId,
            canvas = this.diagramDesigner,
            connectionMetaInfo = null,
            areas = canvas.items[objId].getConnectionAreas(subCompId, true, connectionMetaInfo) || [],
            j = areas.length,
            newBox = { 'x1': null, 
                'x2': null, 
                'y1': null, 
                'y2': null,
                'ports': [] };

        while (j--) {
            var angles = [ areas[j].angle1, areas[j].angle2 ],
                x1 = Math.min(areas[j].x1, areas[j].x2),
                x2 = Math.max(areas[j].x1, areas[j].x2),
                y1 = Math.min(areas[j].y1, areas[j].y2),
                y2 = Math.max(areas[j].y1, areas[j].y2);

            newBox.ports.push({ 'id': areas[j].id, 'area': [ [ x1, y1 ], [ x2, y2 ] ],
                    'angles': angles });

            if(angles) {
                var a1 = angles[0], //min angle
                    a2 = angles[1], //max angle
                    rightAngle = 0,
                    bottomAngle = 90,
                    leftAngle = 180,
                    topAngle = 270;

                if (rightAngle < a1 || rightAngle > a2) {
                    x2 += 5;
                }

                if (leftAngle < a1 || leftAngle > a2) {
                    x1 -= 5;
                }

                if (topAngle < a1 || topAngle > a2) {
                    y1 -= 5;
                }

                if (bottomAngle < a1 || bottomAngle > a2) {
                    y2 += 5;
                }

            }else{
                if(x2 - x1 < 3) {
                    x2 += 3;
                }

                if(y2 - y1 < 3) {
                    y2 += 3;
                }
            }

            //Derive the box object
            newBox.x2 = Math.max(x2 + 1, newBox.x2) || x2 + 1;
            newBox.y1 = Math.min(y1 - 1, newBox.y1) || y1 - 1;
            newBox.x1 = Math.min(x1 - 1, newBox.x1) || x1 - 1;
            newBox.y2 = Math.max(y2 + 1, newBox.y2) || y2 + 1;
        }

        return newBox;
    };

    _.extend(ConnectionRouteManager3.prototype, ActionApplier.prototype);

    return ConnectionRouteManager3;
});
