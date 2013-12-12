"use strict";

define(['logManager',
    'clientUtil',
    'js/Constants',
    'js/NodePropertyNames',
    'js/Utils/GMEConcepts',
    'js/Widgets/DiagramDesigner/DiagramDesignerWidget.Constants',
    'js/DragDrop/DragHelper'], function (logManager,
                                                        util,
                                                        CONSTANTS,
                                                        nodePropertyNames,
                                                        GMEConcepts,
                                                        DiagramDesignerWidgetConstants,
                                                        DragHelper) {

    var ModelEditorControlDiagramDesignerWidgetEventHandlers,
        ATTRIBUTES_STRING = "attributes",
        REGISTRY_STRING = "registry",
        SRC_POINTER_NAME = CONSTANTS.POINTER_SOURCE,
        DST_POINTER_NAME = CONSTANTS.POINTER_TARGET;

    ModelEditorControlDiagramDesignerWidgetEventHandlers = function () {
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype.attachDiagramDesignerWidgetEventHandlers = function () {
        var self = this;

        /*OVERRIDE DESIGNER CANVAS METHODS*/
        /*this.designerCanvas.onDesignerItemsMove = function (repositionDesc) {
            self._onDesignerItemsMove(repositionDesc);
        };

        this.designerCanvas.onDesignerItemsCopy = function (copyDesc) {
            self._onDesignerItemsCopy(copyDesc);
        };*/

        this.designerCanvas.onCreateNewConnection = function (params) {
            self._onCreateNewConnection(params);
        };

        this.designerCanvas.onSelectionDelete = function (idList) {
            self._onSelectionDelete(idList);
        };

        this.designerCanvas.onDesignerItemDoubleClick = function (id, event) {
            self._onDesignerItemDoubleClick(id, event);
        };

        this.designerCanvas.onModifyConnectionEnd = function (params) {
            self._onModifyConnectionEnd(params);
        };

        this.designerCanvas.onRegisterSubcomponent = function (objID, sCompID, metaInfo) {
            self._onRegisterSubcomponent(objID, sCompID, metaInfo);
        };

        this.designerCanvas.onUnregisterSubcomponent = function (objID, sCompID) {
            self._onUnregisterSubcomponent(objID, sCompID);
        };

        this.designerCanvas.onBackgroundDroppableAccept = function (event, dragInfo) {
            return self._onBackgroundDroppableAccept(event, dragInfo);
        };

        this.designerCanvas.onBackgroundDrop = function (event, dragInfo, position) {
            self._onBackgroundDrop(event, dragInfo, position);
        };

        this.designerCanvas.onSelectionChanged = function (selectedIds) {
            self._onSelectionChanged(selectedIds);
        };

        this.designerCanvas.onClipboardCopy = function (selectedIds) {
            self._onClipboardCopy(selectedIds);
        };

        this.designerCanvas.onClipboardPaste = function () {
            self._onClipboardPaste();
        };

        this.designerCanvas.onConnectionSegmentPointsChange = function (params) {
            self._onConnectionSegmentPointsChange(params);
        };

        this.designerCanvas.onFilterNewConnectionDroppableEnds = function (params) {
            return self._onFilterNewConnectionDroppableEnds(params);
        };

        this.designerCanvas.onFilterReconnectionDroppableEnds = function (params) {
            return self._onFilterReconnectionDroppableEnds(params);
        };

        this.designerCanvas.onDragStartDesignerItemDraggable = function (itemID) {
            return self._onDragStartDesignerItemDraggable(itemID);
        };

        this.designerCanvas.onDragStartDesignerItemCopyable = function (itemID) {
            return self._onDragStartDesignerItemCopyable(itemID);
        };

        this.designerCanvas.onDragStartDesignerConnectionCopyable = function (connectionID) {
            return self._onDragStartDesignerConnectionCopyable(connectionID);
        };

        this.designerCanvas.onSelectionRotated = function (deg, selectedIds) {
            return self._onSelectionRotated(deg, selectedIds);
        };

        this.designerCanvas.onSetConnectionProperty = function (params) {
            self._onSetConnectionProperty(params);
        };

        this.designerCanvas.onCopy = function () {
            return self._onCopy();
        };

        this.designerCanvas.onPaste = function (data) {
            return self._onPaste(data);
        };

        this.designerCanvas.getDragItems = function (selectedElements) {
            return self._getDragItems(selectedElements);
        };

        this._oGetDragParams = this.designerCanvas.getDragParams;
        this.designerCanvas.getDragParams = function (selectedElements, event) {
            return self._getDragParams(selectedElements, event);
        };

        this.logger.debug("attachDiagramDesignerWidgetEventHandlers finished");
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onDesignerItemsMove = function (repositionDesc) {
        var id;

        this._client.startTransaction();
        for (id in repositionDesc) {
            if (repositionDesc.hasOwnProperty(id)) {
                this._client.setRegistry(this._ComponentID2GmeID[id], nodePropertyNames.Registry.position, { "x": repositionDesc[id].x, "y": repositionDesc[id].y });
            }
        }
        this._client.completeTransaction();
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onDesignerItemsCopy = function (copyDesc) {
        var copyOpts = { "parentId": this.currentNodeInfo.id },
            id,
            desc,
            gmeID;

        this.designerCanvas.beginUpdate();

        for (id in copyDesc.items) {
            if (copyDesc.items.hasOwnProperty(id)) {
                desc = copyDesc.items[id];
                gmeID = this._ComponentID2GmeID[desc.oItemId];

                copyOpts[gmeID] = {};
                copyOpts[gmeID][ATTRIBUTES_STRING] = {};
                copyOpts[gmeID][REGISTRY_STRING] = {};

                copyOpts[gmeID][REGISTRY_STRING][nodePropertyNames.Registry.position] = { "x": desc.posX, "y": desc.posY };

                //remove the component from UI
                //it will be recreated when the GME client calls back with the result
                this.designerCanvas.deleteComponent(id);
            }
        }

        for (id in copyDesc.connections) {
            if (copyDesc.connections.hasOwnProperty(id)) {
                desc = copyDesc.connections[id];
                gmeID = this._ComponentID2GmeID[desc.oConnectionId];

                copyOpts[gmeID] = {};

                //remove the component from UI
                //it will be recreated when the GME client calls back with the result
                this.designerCanvas.deleteComponent(id);
            }
        }

        this.designerCanvas.endUpdate();

        this._client.intellyPaste(copyOpts);
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onCreateNewConnection = function (params) {
        var sourceId,
            targetId,
            parentId = this.currentNodeInfo.id,
            createConnection,
            _client = this._client,
            CONTEXT_POS_OFFSET = 10,
            menuItems = {},
            i,
            connTypeObj;

        //local callback to create the connection
        createConnection = function (connTypeToCreate) {
            if (connTypeToCreate) {
                _client.startTransaction();

                //create new object
                var newConnID = _client.createChild({'parentId': parentId, 'baseId': connTypeToCreate});

                //set source and target pointers
                _client.makePointer(newConnID, CONSTANTS.POINTER_SOURCE, sourceId);
                _client.makePointer(newConnID, CONSTANTS.POINTER_TARGET, targetId);

                _client.completeTransaction();
            }
        };

        if (params.srcSubCompId !== undefined) {
            sourceId = this._Subcomponent2GMEID[params.src][params.srcSubCompId];
        } else {
            sourceId = this._ComponentID2GmeID[params.src];
        }

        if (params.dstSubCompId !== undefined) {
            targetId = this._Subcomponent2GMEID[params.dst][params.dstSubCompId];
        } else {
            targetId = this._ComponentID2GmeID[params.dst];
        }

        //get the list of valid connection types
        var validConnectionTypes = GMEConcepts.getValidConnectionTypes(sourceId, targetId, parentId);
        //filter them to see which of those can actually be created as a child of the parent
        i = validConnectionTypes.length;
        while (i--) {
            if (!GMEConcepts.canCreateChild(parentId, validConnectionTypes[i])) {
                validConnectionTypes.splice(i,1);
            }
        }

        if (validConnectionTypes.length === 1) {
            createConnection(validConnectionTypes[0]);
        } else if (validConnectionTypes.length > 1) {
            //show available connection types to the user to select one
            for (i = 0; i < validConnectionTypes.length; i += 1) {
                connTypeObj = this._client.getNode(validConnectionTypes[i]);
                menuItems[validConnectionTypes[i]] = {
                    "name": 'Create type \'' + (connTypeObj ? connTypeObj.getAttribute(nodePropertyNames.Attributes.name) : validConnectionTypes[i]) + '\'',
                    "icon": false
                };
            }

            var dstPosition = this.designerCanvas.items[params.dst].getBoundingBox();

            this.designerCanvas.createMenu(menuItems, function (key) {
                    createConnection(key);
                },
                this.designerCanvas.posToPageXY(dstPosition.x - CONTEXT_POS_OFFSET,
                                                dstPosition.y - CONTEXT_POS_OFFSET)
            );
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onSelectionDelete = function (idList) {
        var objIdList = [],
            i = idList.length,
            objID;

        while(i--) {
            objID = this._ComponentID2GmeID[idList[i]];
            //temporary fix to not allow deleting ROOT AND FCO
            if (GMEConcepts.canDeleteNode(objID)) {
                objIdList.pushUnique(objID);
            } else {
                this.logger.warning('Can not delete item with ID: ' + objID + '. Possibly it is the ROOT or FCO');
            }
        }

        if (objIdList.length > 0) {
            this._client.delMoreNodes(objIdList);
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onDesignerItemDoubleClick = function (id, event) {
        var gmeID = this._ComponentID2GmeID[id];

        if (gmeID) {
            this.logger.debug("Opening model with id '" + gmeID + "'");
            this._client.setSelectedObjectId(gmeID);
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onModifyConnectionEnd = function (params) {
        var gmeID = this._ComponentID2GmeID[params.id],
            oldDesc = params.old,
            newDesc = params.new,
            newEndPointGMEID;

        if (gmeID) {
            this._client.startTransaction();

            //update connection endpoint - SOURCE
            if (oldDesc.srcObjId !== newDesc.srcObjId ||
                oldDesc.srcSubCompId !== newDesc.srcSubCompId) {
                if (newDesc.srcSubCompId !== undefined ) {
                    newEndPointGMEID = this._Subcomponent2GMEID[newDesc.srcObjId][newDesc.srcSubCompId];
                } else {
                    newEndPointGMEID = this._ComponentID2GmeID[newDesc.srcObjId];
                }
                this._client.makePointer(gmeID, SRC_POINTER_NAME, newEndPointGMEID);
            }

            //update connection endpoint - TARGET
            if (oldDesc.dstObjId !== newDesc.dstObjId ||
                oldDesc.dstSubCompId !== newDesc.dstSubCompId) {
                if (newDesc.dstSubCompId !== undefined ) {
                    newEndPointGMEID = this._Subcomponent2GMEID[newDesc.dstObjId][newDesc.dstSubCompId];
                } else {
                    newEndPointGMEID = this._ComponentID2GmeID[newDesc.dstObjId];
                }
                this._client.makePointer(gmeID, DST_POINTER_NAME, newEndPointGMEID);
            }

            this._client.completeTransaction();
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onRegisterSubcomponent = function (objID, sCompID, metaInfo) {
        //store that a subcomponent with a given ID has been added to object with objID
        this._GMEID2Subcomponent[metaInfo[CONSTANTS.GME_ID]] = this._GMEID2Subcomponent[metaInfo[CONSTANTS.GME_ID]] || {};
        this._GMEID2Subcomponent[metaInfo[CONSTANTS.GME_ID]][objID] = sCompID;

        this._Subcomponent2GMEID[objID] = this._Subcomponent2GMEID[objID] || {};
        this._Subcomponent2GMEID[objID][sCompID] = metaInfo[CONSTANTS.GME_ID];
        //TODO: add event handling here that a subcomponent appeared
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onUnregisterSubcomponent = function (objID, sCompID) {
        var gmeID = this._Subcomponent2GMEID[objID][sCompID];

        delete this._Subcomponent2GMEID[objID][sCompID];
        delete this._GMEID2Subcomponent[gmeID][objID];
        //TODO: add event handling here that a subcomponent disappeared
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._getPossibleDropActions = function (dragInfo) {
        var items = DragHelper.getDragItems(dragInfo),
            dragEffects = DragHelper.getDragEffects(dragInfo),
            dragParams = DragHelper.getDragParams(dragInfo),
            possibleDropActions = [],
            parentID = this.currentNodeInfo.id,
            i,
            validReferenceTypes,
            j,
            validReferenceTypesNames = [],
            validReferenceTypesMap = {},
            refTypeID,
            refTypeName,
            refTypeNode,
            dragAction;

        //check to see what DROP actions are possible
        if (items.length > 0) {
            i = dragEffects.length;
            while (i--) {
                switch(dragEffects[i]) {
                    case DragHelper.DRAG_EFFECTS.DRAG_MOVE:
                        //check to see if dragParams.parentID and this.parentID are the same
                        //if so, it's not a real move, it is a reposition
                        if ((dragParams && dragParams.parentID && dragParams.parentID === parentID) ||
                            GMEConcepts.canCreateChildren(parentID, items)) {
                            dragAction = {'dragEffect': dragEffects[i]};
                            possibleDropActions.push(dragAction);
                        }
                        break;
                    case DragHelper.DRAG_EFFECTS.DRAG_COPY:
                        if (GMEConcepts.canCreateChildren(parentID, items)) {
                            dragAction = {'dragEffect': dragEffects[i]};
                            possibleDropActions.push(dragAction);
                        }
                        break;
                    case DragHelper.DRAG_EFFECTS.DRAG_CREATE_INSTANCE:
                        if (GMEConcepts.canCreateChildren(parentID, items)) {
                            dragAction = {'dragEffect': dragEffects[i]};
                            possibleDropActions.push(dragAction);
                        }
                        break;
                    case DragHelper.DRAG_EFFECTS.DRAG_CREATE_REFERENCE:
                        validReferenceTypes = GMEConcepts.getValidReferenceTypes(parentID, items[0]);
                        if (items.length === 1 && validReferenceTypes.length > 0) {
                            //possibleDropActions.push(dragEffects[i]);
                            j = validReferenceTypes.length;
                            while (j--) {
                                refTypeID = validReferenceTypes[j];
                                refTypeNode = this._client.getNode(refTypeID);
                                refTypeName = refTypeNode ? refTypeNode.getAttribute(nodePropertyNames.Attributes.name) : '(' + refTypeID + ')';
                                validReferenceTypesNames.push(refTypeName);
                                validReferenceTypesMap[refTypeName] = refTypeID;
                            }
                            validReferenceTypesNames.sort();
                            validReferenceTypesNames.reverse();
                            j = validReferenceTypesNames.length;
                            while (j--) {
                                dragAction = { 'dragEffect': DragHelper.DRAG_EFFECTS.DRAG_CREATE_REFERENCE,
                                              'name': validReferenceTypesNames[j],
                                              'id': validReferenceTypesMap[validReferenceTypesNames[j]]};
                                possibleDropActions.push(dragAction);
                            }
                        }
                        break;
                }
            }
        }

        this.logger.debug('possibleDropActions: ' + JSON.stringify(possibleDropActions));

        return possibleDropActions;
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onBackgroundDroppableAccept = function (event, dragInfo) {
        var accept;

        accept = this._getPossibleDropActions(dragInfo).length > 0;

        return accept;
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onBackgroundDrop = function (event, dragInfo, position) {
        var possibleDropActions = this._getPossibleDropActions(dragInfo),
            len = possibleDropActions.length,
            i,
            selectedAction,
            self = this;

        if (len === 1) {
            selectedAction = possibleDropActions[0];
            this._handleDropAction(selectedAction, dragInfo, position);
        } else {
            var menuItems = {};

            for (i = 0; i < possibleDropActions.length; i += 1) {
                switch (possibleDropActions[i].dragEffect) {
                    case DragHelper.DRAG_EFFECTS.DRAG_COPY:
                        menuItems[i] = {
                            "name": "Copy here",
                            "icon": 'icon-plus'
                        };
                        break;
                    case DragHelper.DRAG_EFFECTS.DRAG_MOVE:
                        menuItems[i] = {
                            "name": "Move here",
                            "icon": 'icon-move'
                        };
                        break;
                    case DragHelper.DRAG_EFFECTS.DRAG_CREATE_INSTANCE:
                        menuItems[i] = {
                            "name": "Create instance here",
                            "icon": 'icon-share-alt'
                        };
                        break;
                    case DragHelper.DRAG_EFFECTS.DRAG_CREATE_REFERENCE:
                        menuItems[i] = {
                            "name": "Create reference '" + possibleDropActions[i].name + "'",
                            "icon": 'icon-share'
                        };
                        break;
                    default:
                }
            }

            this.designerCanvas.createMenu(menuItems, function (key) {
                    selectedAction = possibleDropActions[parseInt(key, 10)];
                    self._handleDropAction(selectedAction, dragInfo, position);
                },
                this.designerCanvas.posToPageXY(position.x, position.y)
            );
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._handleDropAction = function (dropAction, dragInfo, position) {
        var dragEffect = dropAction.dragEffect,
            items = DragHelper.getDragItems(dragInfo),
            dragParams = DragHelper.getDragParams(dragInfo),
            parentID = this.currentNodeInfo.id,
            i,
            gmeID,
            params,
            POS_INC = 20,
            oldPos;

        this.logger.debug('dropAction: ' + JSON.stringify(dropAction));
        this.logger.debug('dragInfo: ' + JSON.stringify(dragInfo));
        this.logger.debug('position: ' + JSON.stringify(position));

        switch (dragEffect) {
            case DragHelper.DRAG_EFFECTS.DRAG_COPY:
                params = { "parentId": parentID };
                i = items.length;
                while (i--) {
                    gmeID = items[i];

                    params[gmeID] = {};

                    oldPos = dragParams && dragParams.positions[gmeID] || {'x':0, 'y': 0};
                    params[gmeID][REGISTRY_STRING] = {};
                    params[gmeID][REGISTRY_STRING][nodePropertyNames.Registry.position] = { "x": position.x + oldPos.x, "y": position.y + oldPos.y };
                }
                this._client.startTransaction();
                this._client.copyMoreNodes(params);
                this._client.completeTransaction();
                break;
            case DragHelper.DRAG_EFFECTS.DRAG_MOVE:
                //check to see if dragParams.parentID and this.parentID are the same
                //if so, it's not a real move, it is a reposition
                if (dragParams && dragParams.parentID && dragParams.parentID === parentID) {
                    //it is a reposition
                    this._repositionItems(items, dragParams.positions, position);
                } else {
                    //it is a real hierarchical move

                    params = { "parentId": parentID };
                    i = items.length;
                    while (i--) {
                        gmeID = items[i];

                        params[gmeID] = {};

                        oldPos = dragParams && dragParams.positions[gmeID] || {'x':0, 'y': 0};
                        params[gmeID][REGISTRY_STRING] = {};
                        params[gmeID][REGISTRY_STRING][nodePropertyNames.Registry.position] = { "x": position.x + oldPos.x, "y": position.y + oldPos.y };
                    }

                    this._client.startTransaction();
                    this._client.moveMoreNodes(params);
                    this._client.completeTransaction();
                }
                break;
            case DragHelper.DRAG_EFFECTS.DRAG_CREATE_INSTANCE:
                params = { "parentId": parentID };
                i = items.length;
                /*this._client.startTransaction();
                while (i--) {
                    params.baseId = items[i];

                    gmeID = this._client.createChild(params);

                    if (gmeID) {
                        //check if old position is in drag-params
                        oldPos = dragParams && dragParams.positions[items[i]] || {'x':0, 'y': 0};
                        //store new position
                        this._client.setRegistry(gmeID, nodePropertyNames.Registry.position, {'x': position.x + oldPos.x,
                            'y': position.y + oldPos.y});

                        //old position is not in drag-params
                        if (!(dragParams && dragParams.positions[items[i]])) {
                            position.x += POS_INC;
                            position.y += POS_INC;
                        }
                    }
                }
                this._client.completeTransaction();*/
                while(i--){
                    oldPos = dragParams && dragParams.positions[items[i]] || {'x':0, 'y': 0};
                    params[items[i]] = {registry:{position:{x:position.x+oldPos.x,y:position.y+oldPos.y}}};
                    //old position is not in drag-params
                    if (!(dragParams && dragParams.positions[items[i]])) {
                        position.x += POS_INC;
                        position.y += POS_INC;
                    }
                }
                this._client.createChildren(params);
                
                break;
            case DragHelper.DRAG_EFFECTS.DRAG_CREATE_REFERENCE:
                if (items.length === 1) {
                    params = { "parentId": parentID,
                               "baseId": dropAction.id};

                    this._client.startTransaction();

                    gmeID = this._client.createChild(params);

                    if (gmeID) {
                        //check if old position is in drag-params
                        oldPos = dragParams && dragParams.positions[items[0]] || {'x':0, 'y': 0};
                        //store new position
                        this._client.setRegistry(gmeID, nodePropertyNames.Registry.position, {'x': position.x + oldPos.x,
                            'y': position.y + oldPos.y});

                        //set reference
                        this._client.makePointer(gmeID, CONSTANTS.POINTER_REF, items[0]);
                    }

                    this._client.completeTransaction();
                }
                break;
        }


    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._repositionItems = function (items, dragPositions, dropPosition) {
        var i = items.length,
            oldPos,
            componentID,
            gmeID,
            selectedIDs = [],
            len,
            self = this;

        if (dragPositions && !_.isEmpty(dragPositions)) {
            //update UI
            this.designerCanvas.beginUpdate();

            while (i--) {
                gmeID = items[i];
                oldPos = dragPositions[gmeID];
                if (!oldPos) {
                    oldPos = {'x': 0, 'y': 0};
                }

                if (this._GmeID2ComponentID.hasOwnProperty(gmeID)) {
                    len = this._GmeID2ComponentID[gmeID].length;
                    while (len--) {
                        componentID = this._GmeID2ComponentID[gmeID][len];
                        selectedIDs.push(componentID);
                        this.designerCanvas.updateDesignerItem(componentID, { "position": {"x": dropPosition.x + oldPos.x, "y": dropPosition.y + oldPos.y }});
                    }
                }
            }

            this.designerCanvas.endUpdate();
            this.designerCanvas.select(selectedIDs);

            //update object internals
            setTimeout(function () {
                self._client.startTransaction();
                i = items.length;
                while (i--) {
                    gmeID = items[i];
                    oldPos = dragPositions[gmeID];
                    if (!oldPos) {
                        oldPos = {'x': 0, 'y': 0};
                    }
                    self._client.setRegistry(gmeID, nodePropertyNames.Registry.position, { "x": dropPosition.x + oldPos.x, "y": dropPosition.y + oldPos.y });
                }

                self._client.completeTransaction();
            }, 10);
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onSelectionChanged = function (selectedIds) {
        var gmeIDs = [],
            len = selectedIds.length,
            id,
            connectionSelected = false,
            allHasRegistrylineStyle = selectedIds.length > 0,
            nodeObj,
            lineStyle;

        while (len--) {
            id = this._ComponentID2GmeID[selectedIds[len]];
            if (id) {
                gmeIDs.push(id);

                nodeObj = this._client.getNode(id);

                if (allHasRegistrylineStyle && nodeObj) {
                    lineStyle = nodeObj.getRegistry(nodePropertyNames.Registry.lineStyle);
                    allHasRegistrylineStyle = lineStyle && !_.isEmpty(lineStyle);
                } else {
                    allHasRegistrylineStyle = false;
                }
            }

            if (this.designerCanvas.connectionIds.indexOf(selectedIds[len]) !== -1) {
                connectionSelected = true;
            }
        }

        this.designerCanvas.toolbarItems.ddbtnConnectionArrowStart.enabled(allHasRegistrylineStyle);
        this.designerCanvas.toolbarItems.ddbtnConnectionPattern.enabled(allHasRegistrylineStyle);
        this.designerCanvas.toolbarItems.ddbtnConnectionArrowEnd.enabled(allHasRegistrylineStyle);
        this.designerCanvas.toolbarItems.ddbtnConnectionLineType.enabled(allHasRegistrylineStyle);

        this.$btnConnectionRemoveSegmentPoints.enabled(connectionSelected);

        //nobody is selected on the canvas
        //set the active selection to the opened guy
        if (gmeIDs.length === 0 && this.currentNodeInfo.id) {
            gmeIDs.push(this.currentNodeInfo.id);
        }

        if (gmeIDs.length !== 0) {
            this._client.setPropertyEditorIdList(gmeIDs);
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onClipboardCopy = function (selectedIds) {
        var gmeIDs = [],
            len = selectedIds.length,
            id;

        while (len--) {
            id = this._ComponentID2GmeID[selectedIds[len]];
            if (id) {
                gmeIDs.push(id);
            }
        }

        if (gmeIDs.length !== 0) {
            this._client.copyNodes(gmeIDs);
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onClipboardPaste = function () {
        if (this.currentNodeInfo.id) {
            this._client.pasteNodes(this.currentNodeInfo.id);
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onConnectionSegmentPointsChange = function (params) {
        var connID = params.connectionID,
            points = params.points,
            gmeID = this._ComponentID2GmeID[connID],
            nodeObj,
            lineStyle;

        if (gmeID) {
            nodeObj = this._client.getNode(gmeID);
            if (nodeObj) {
                lineStyle = nodeObj.getEditableRegistry(nodePropertyNames.Registry.lineStyle) || {};
                lineStyle[DiagramDesignerWidgetConstants.LINE_POINTS] = points;

                this._client.setRegistry(gmeID, nodePropertyNames.Registry.lineStyle, lineStyle);
            }
        }
    };


    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onFilterNewConnectionDroppableEnds = function (params) {
        var availableConnectionEnds = params.availableConnectionEnds,
            result = [],
            i = availableConnectionEnds.length,
            sourceId,
            targetId,
            validConnectionTypes,
            j,
            canCreateChildOfConnectionType,
            parentID = this.currentNodeInfo.id,
            client = this._client;

        if (params.srcSubCompId !== undefined) {
            sourceId = this._Subcomponent2GMEID[params.srcId][params.srcSubCompId];
        } else {
            sourceId = this._ComponentID2GmeID[params.srcId];
        }

        //need to test for each source-destination pair if the connection can be made or not?
        //there is at least one valid connection type definition in the parent that could be created between the source and target
        //there is at least one valid connection type that really can be created in the parent (max chilren num...)
        validConnectionTypes = GMEConcepts.getValidConnectionTypesInParent(sourceId, parentID);

        while (i--) {
            var p = availableConnectionEnds[i];
            if (p.dstSubCompID !== undefined) {
                targetId = this._Subcomponent2GMEID[p.dstItemID][p.dstSubCompID];
            } else {
                targetId = this._ComponentID2GmeID[p.dstItemID];
            }

            j = validConnectionTypes.length;
            while (j--) {
                if (client.isValidTarget(validConnectionTypes[j], CONSTANTS.POINTER_TARGET, targetId)) {
                    result.push(availableConnectionEnds[i]);
                    break;
                }
            }
        }

        return result;
    };


    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onFilterReconnectionDroppableEnds = function (params) {
        var connID = params.connId,
            srcDragged = params.draggedEnd === DiagramDesignerWidgetConstants.CONNECTION_END_SRC,
            srcItemID = params.srcItemID,
            srcSubCompID = params.srcSubCompID,
            dstItemID = params.dstItemID,
            dstSubCompID = params.dstSubCompID,
            availableConnectionEnds = params.availableConnectionEnds,
            availableConnectionSources = params.availableConnectionSources,
            i,
            result = [],
            newEndPointGMEID,
            oldEndPointGMEID,
            connectionGMEID = this._ComponentID2GmeID[connID];

        if (srcDragged === true) {
            //'src' end of the connection is being dragged
            //'dst end is fix
            if (dstSubCompID !== undefined ) {
                oldEndPointGMEID = this._Subcomponent2GMEID[dstItemID][dstSubCompID];
            } else {
                oldEndPointGMEID = this._ComponentID2GmeID[dstItemID];
            }
            //need to check for all possible 'src' if the connection's end could be changed to that value
            i = availableConnectionSources.length;
            while (i--) {
                srcItemID = availableConnectionSources[i].srcItemID;
                srcSubCompID = availableConnectionSources[i].srcSubCompID;
                if (srcSubCompID !== undefined ) {
                    newEndPointGMEID = this._Subcomponent2GMEID[srcItemID][srcSubCompID];
                } else {
                    newEndPointGMEID = this._ComponentID2GmeID[srcItemID];
                }

                if (GMEConcepts.isValidConnection(newEndPointGMEID, oldEndPointGMEID, connectionGMEID) === true) {
                    result.push(availableConnectionSources[i]);
                }
            }
        } else {
            //'dst' end of the connection is being dragged
            //'src end is fix
            if (srcSubCompID !== undefined ) {
                oldEndPointGMEID = this._Subcomponent2GMEID[srcItemID][srcSubCompID];
            } else {
                oldEndPointGMEID = this._ComponentID2GmeID[srcItemID];
            }
            //need to check for all possible 'dst' if the connection's end could be changed to that value
            i = availableConnectionEnds.length;
            while (i--) {
                dstItemID = availableConnectionEnds[i].dstItemID;
                dstSubCompID = availableConnectionEnds[i].dstSubCompID;
                if (dstSubCompID !== undefined ) {
                    newEndPointGMEID = this._Subcomponent2GMEID[dstItemID][dstSubCompID];
                } else {
                    newEndPointGMEID = this._ComponentID2GmeID[dstItemID];
                }
                if (GMEConcepts.isValidConnection(oldEndPointGMEID, newEndPointGMEID, connectionGMEID) === true) {
                    result.push(availableConnectionEnds[i]);
                }
            }
        }

        return result;
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onDragStartDesignerItemDraggable = function (itemID) {
        var nodeObj = this._client.getNode(this._ComponentID2GmeID[itemID]),
            result = true;

        if (nodeObj) {
            result = this._client.canSetRegistry(nodeObj.getId(), nodePropertyNames.Registry.position);
        }

        return result;
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onDragStartDesignerItemCopyable = function (itemID) {
        var nodeObj = this._client.getNode(this._ComponentID2GmeID[itemID]),
            result = true;

        if (nodeObj) {
            result = nodeObj.getAttribute('copy') != "false";
        }

        return result;
    };


    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onDragStartDesignerConnectionCopyable = function (connectionID) {
        return this._onDragStartDesignerItemCopyable(connectionID);
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onSelectionRotated = function (degree, selectedIds) {
        var i = selectedIds.length,
            regDegree,
            gmeID;

        this._client.startTransaction();
        while(i--) {
            gmeID = this._ComponentID2GmeID[selectedIds[i]];
            regDegree = this._client.getNode(gmeID).getRegistry(nodePropertyNames.Registry.rotation);
            this._client.setRegistry(gmeID, nodePropertyNames.Registry.rotation, ((regDegree || 0) + degree) % 360 );
        }
        this._client.completeTransaction();
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onSetConnectionProperty = function (params) {
        var items = params.items,
            visualParams = params.params,
            gmeIDs = [],
            len = items.length,
            id,
            connRegLineStyle;

        while (len--) {
            id = this._ComponentID2GmeID[items[len]];
            if (id) {
                gmeIDs.push(id);
            }
        }

        len = gmeIDs.length;
        if (len > 0) {
            this._client.startTransaction();

            while(len--) {
                id = gmeIDs[len];
                connRegLineStyle = this._client.getNode(id).getEditableRegistry(nodePropertyNames.Registry.lineStyle);
                if (connRegLineStyle && !_.isEmpty(connRegLineStyle)) {
                    _.extend(connRegLineStyle, visualParams);
                    this._client.setRegistry(id, nodePropertyNames.Registry.lineStyle, connRegLineStyle);
                }
            }

            this._client.completeTransaction();
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onCopy = function () {
        var res = [],
            selectedIDs = this.designerCanvas.selectionManager.getSelectedElements(),
            i = selectedIDs.length,
            gmeID,
            obj,
            nodeObj,
            cpData = {'project': this._client.getActiveProject(),
                      'items' : []};

        while(i--) {
            gmeID = this._ComponentID2GmeID[selectedIDs[i]];
            obj = {'ID': gmeID,
                   'Name': undefined,
                   'Position': undefined};

            nodeObj = this._client.getNode(gmeID);
            if (nodeObj) {
                obj.Name = nodeObj.getAttribute(nodePropertyNames.Attributes.name);
                obj.Position = nodeObj.getRegistry(nodePropertyNames.Registry.position);
            }

            res.push(obj);
        }

        cpData.items = res;

        return cpData;
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onPaste = function (data) {
        var len,
            objDesc,
            parentID = this.currentNodeInfo.id,
            params = { "parentId": parentID },
            projectName = this._client.getActiveProject(),
            childrenIDs = [];

        if (parentID) {
            try {
                data = JSON.parse(data);
            } catch (e) {
                this.logger.error('Invalid clipboard data: "' + data + '"');
                data = undefined;
            }

            if (data && data.project && data.items) {
                if (projectName !== data.project) {
                    alert('Trying to copy from project \'' + data.project + '\' to project \'' + projectName + '\' which is not supported... Copy&Paste is supported in the same project only.');
                } else {
                    if (_.isArray(data.items)) {
                        data = data.items;
                        len = data.length;

                        while (len--) {
                            objDesc = data[len];

                            if (objDesc && objDesc.ID) {
                                params[objDesc.ID] = {};
                                childrenIDs.push(objDesc.ID);
                            }
                        }

                        if (GMEConcepts.canCreateChildren(parentID, childrenIDs)) {
                            this._client.startTransaction();
                            this._client.copyMoreNodes(params);
                            this._client.completeTransaction();
                            this.logger.warning('Pasted ' + childrenIDs.length + ' items successfully into node (' + parentID + ')');
                        } else {
                            this.logger.warning('Can not paste items because not all the items on the clipboard can be created as a child of the currently opened node (' + parentID + ')');
                        }
                    }
                }
            }
        }
    };


    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._getDragItems = function (selectedElements) {
        var res = [],
            i = selectedElements.length;

        while(i--) {
            res.push(this._ComponentID2GmeID[selectedElements[i]]);
        }

        return res;
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._getDragParams = function (selectedElements, event) {
        var oParams = this._oGetDragParams.call(this.designerCanvas, selectedElements, event),
            params = { 'positions': {},
                       'parentID': this.currentNodeInfo.id },
            i;

        for (i in oParams.positions) {
            if (oParams.positions.hasOwnProperty(i)) {
                params.positions[this._ComponentID2GmeID[i]] = oParams.positions[i];
            }
        }

        return params;
    };

    return ModelEditorControlDiagramDesignerWidgetEventHandlers;
});
