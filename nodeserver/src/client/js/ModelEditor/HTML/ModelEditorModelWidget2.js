"use strict";

define(['logManager',
        'clientUtil',
        'notificationManager',
        './WidgetBase2.js',
        './ModelEditorPortWidget2.js'], function (logManager,
                                                  util,
                                                  notificationManager,
                                                  WidgetBase,
                                                  ModelEditorPortWidget2) {

    //load its own CSS file (css/ModelEditorSVGWidget.css)
    util.loadCSS('css/ModelEditorModelWidget.css');

    var ModelEditorModelWidget2 = function (id, proj) {
        var logger,
            self = this,
            selfId,
            selfPatterns = {},
            skinContent = {},
            refresh,
            editNodeTitle,
            initialize,
            childrenIds = [],
            renderPort,
            refreshChildrenContainer;

        $.extend(this, new WidgetBase(id, proj));

        //get logger instance for this component
        logger = logManager.create("ModelEditorModelWidget2_" + id);

        initialize = function () {
            var newPattern,
                node = self.project.getNode(self.getId()),
                nodePosition = node.getRegistry(self.nodeRegistryNames.position);

            selfId = self.project.addUI(self);
            childrenIds = node.getChildrenIds();

            //generate skin controls
            $(self.el).css("z-index", 10);
            $(self.el).addClass("model");

            //node title
            self.skinParts.title = $('<div/>');
            self.skinParts.title.addClass("modelTitle");
            self.el.append(self.skinParts.title);

            //children container
            self.skinParts.childrenContainer = $('<div/>', {
                "class" : "children"
            });
            self.el.append(self.skinParts.childrenContainer);

            self.skinParts.leftPorts = $('<div/>', {
                "class" : "ports left"
            });
            self.skinParts.childrenContainer.append(self.skinParts.leftPorts);

            self.skinParts.centerPorts = $('<div/>', {
                "class" : "ports center"
            });
            self.skinParts.childrenContainer.append(self.skinParts.centerPorts);

            self.skinParts.connectionPoint = $('<div/>', {
                "class" : "connectionPoint",
                "id" : "connectionPoint"
            });
            self.skinParts.centerPorts.append(self.skinParts.connectionPoint);

            self.skinParts.connectionPoint.draggable({
                helper: function () {
                    return $("<div class='ui-widget-drag-helper'></div>").data("id", self.getId());
                },
                scroll: true,
                cursor: 'pointer',
                cursorAt: {
                    left: 0,
                    top: 0
                },
                start: function (event, ui) {
                    self.skinParts.connectionPoint.addClass("connectionSource");
                    self.skinParts.connectionPoint.addClass("ui-state-active");
                    self.startPortConnection(self.getId());
                    event.stopPropagation();
                },
                stop: function (event, ui) {
                    self.endPortConnection(self.getId());
                    self.skinParts.connectionPoint.removeClass("connectionSource");
                    self.skinParts.connectionPoint.removeClass("ui-state-active");
                    self.skinParts.connectionPoint.css("opacity", "0.000001");
                    event.stopPropagation();
                },
                drag: function (event, ui) {
                }
            });

            self.skinParts.connectionPoint.droppable({
                accept: ".connectionSource",
                activeClass: "ui-state-active",
                hoverClass: "ui-state-hover",
                drop: function (event, ui) {
                    var srdId = ui.helper.data("id"),
                        trgtId = self.getId();

                    self.parentWidget.createConnection(srdId, trgtId);
                    event.stopPropagation();
                }
            });

            //make it non visible
            self.skinParts.connectionPoint.css("opacity", "0.000001");

            self.skinParts.rightPorts = $('<div/>', {
                "class" : "ports right"
            });
            self.skinParts.childrenContainer.append(self.skinParts.rightPorts);

            //get content from node
            skinContent.title = node.getAttribute(self.nodeAttrNames.name);
            self.setPosition(nodePosition.x, nodePosition.y, true);

            //apply content to controls
            self.skinParts.title.html(skinContent.title);

            //specify territory
            selfPatterns[self.getId()] = { "children": 1};
            self.project.updateTerritory(selfId, selfPatterns);

            //hook up double click for node title edit
            self.skinParts.title.dblclick(editNodeTitle);

            //show and hide action-icons only when mouse is over the model
            self.el.mouseover(function () {
                if (self.skinParts.connectionPoint.hasClass("connectionSource") === false) {
                    self.skinParts.connectionPoint.css("opacity", "1.0");
                }
            }).mouseout(function () {
                if (self.skinParts.connectionPoint.hasClass("connectionSource") === false) {
                    self.skinParts.connectionPoint.css("opacity", "0.000001");
                }
            });
        };

        editNodeTitle = function () {
            //first of all unbind dblclick
            self.skinParts.title.unbind("dblclick");

            // Replace node with <input>
            self.skinParts.title.editInPlace("modelTitle", function (newTitle) {
                skinContent.title = newTitle;
                self.project.setAttributes(self.getId(), "name", newTitle);
                refreshChildrenContainer();
            });

            //hook up double click for node title edit
            self.skinParts.title.dblclick(editNodeTitle);
        };

        this.setPosition = function (pX, pY, noDBUpdate, noParentNotification) {
            var childNode;

            self.el.css("position", "absolute");
            self.el.css("left", pX);
            self.el.css("top", pY);

            //non silent means save pos back to database
            if (noDBUpdate === false) {
                childNode = self.project.getNode(self.getId());
                if (childNode) {
                    logger.debug("Object position changed for id:'" + self.getId() + "', new pos:[" + pX + ", " + pY + "]");
                    self.project.setRegistry(self.getId(), self.nodeRegistryNames.position, { "x": pX, "y": pY });
                }
            }

            if (noParentNotification !== true) {
                if (self.parentWidget) {
                    self.parentWidget.childBBoxChanged(self);
                }
            }
        };

        this.addedToParent = function () {
            var node = self.project.getNode(self.getId()),
                childrenIds = node.getChildrenIds(),
                child,
                i;

            for (i = 0; i < childrenIds.length; i += 1) {
                child = self.project.getNode(childrenIds[i]);
                if (child && child.getAttribute(self.nodeAttrNames.isPort) === true) {
                    renderPort(child, true);
                }
            }
            refreshChildrenContainer();

            if (self.parentWidget) {
                self.parentWidget.childBBoxChanged(self);
            }
        };

        // PUBLIC METHODS
        this.onEvent = function (etype, eid) {
            switch (etype) {
            case "load":
                refresh("insert", eid);
                break;
            case "update":
                refresh("update", eid);
                break;
            case "create":
                //refresh("insert", eid);
                break;
            case "delete":
                //refresh("update", eid);
                break;
            }

        };

        refresh = function (eventType, nodeId) {
            var node = self.project.getNode(nodeId),
                newTitle,
                nodePosition,
                oldChildrenIds = childrenIds,
                currentChildrenIds,
                childrenDeleted,
                childrenAdded,
                j,
                child;

            if (node) {
                if (nodeId === self.getId()) {
                    //update of currently displayed node
                    //- title might have changed
                    //- position might have changed

                    newTitle = node.getAttribute(self.nodeAttrNames.name);
                    if (skinContent.title !== newTitle) {
                        self.skinParts.title.html(newTitle).hide().fadeIn('fast');
                        notificationManager.displayMessage("Object title '" + skinContent.title + "' has been changed to '" + newTitle + "'.");
                        skinContent.title = newTitle;
                        refreshChildrenContainer();
                    }
                    nodePosition = node.getRegistry(self.nodeRegistryNames.position);
                    self.setPosition(nodePosition.x, nodePosition.y, true, false);

                    currentChildrenIds = node.getChildrenIds();

                    //Handle children deletion
                    childrenDeleted = util.arrayMinus(oldChildrenIds, currentChildrenIds);

                    for (j = 0; j < childrenDeleted.length; j += 1) {
                        self.removeChildById(childrenDeleted[j]);
                    }

                    //Handle children addition
                    childrenAdded = util.arrayMinus(currentChildrenIds, oldChildrenIds);
                    for (j = 0; j < childrenAdded.length; j += 1) {
                        child = self.project.getNode(childrenAdded[j]);
                        if (child && child.getAttribute(self.nodeAttrNames.isPort) === true) {
                            renderPort(child, true);
                        }
                    }

                    refreshChildrenContainer();

                    //finally store the actual children info for the parent
                    childrenIds = currentChildrenIds;
                } else {
                    if (childrenIds.indexOf(nodeId) !== -1) {
                        //it's the displayed node's child, let's see if it needs to be displayed as a port
                        if (node.getAttribute(self.nodeAttrNames.isPort) === true) {
                            if (self.children[nodeId]) {
                                self.children[nodeId].update(node);
                                refreshChildrenContainer();
                            } else {
                                renderPort(node);
                            }
                        }
                    }
                }
            }
        };

        renderPort = function (portNode, ignoreChildrenContainerRefresh) {
            var nodeId = portNode.getId(),
                portWidget,
                portOrientation = "W",
                portContainer = self.skinParts.leftPorts,
                portPosition = portNode.getRegistry(self.nodeRegistryNames.position);

            //check if the port should be on the left or right-side
            if (portPosition.x > 300) {
                portOrientation = "E";
                portContainer = self.skinParts.rightPorts;
            }

            portWidget = new ModelEditorPortWidget2(nodeId, self.project, {orientation: portOrientation});
            self.addChild(portWidget, portContainer);

            if (ignoreChildrenContainerRefresh !== true) {
                refreshChildrenContainer();
            }
        };

        refreshChildrenContainer = function () {
            var centerPortsWidth = self.skinParts.centerPorts.css("width", "").outerWidth(true),
                childrenContainerWidth = self.skinParts.childrenContainer.width(),
                leftPortsWidth = self.skinParts.leftPorts.outerWidth(true),
                rightPortsWidth = self.skinParts.rightPorts.outerWidth(true);

            if (childrenContainerWidth > leftPortsWidth + centerPortsWidth + rightPortsWidth) {
                self.skinParts.centerPorts.outerWidth(childrenContainerWidth - leftPortsWidth - rightPortsWidth);
            }

            if (self.parentWidget) {
                self.parentWidget.childBBoxChanged(self);
            }
        };

        this.onDestroy = function () {
            self.project.updateTerritory(selfId, []);
        };

        this.onSelect = function () {
            self.el.addClass("selected");
        };

        this.onDeselect = function () {
            self.el.removeClass("selected");
        };

        this.isSelectable = function () {
            return true;
        };

        this.isDraggable = function () {
            return true;
        };

        this.getConnectionPoints = function () {
            var bBox = self.getBoundingBox(),
                result = {  "S" : {x: bBox.x + bBox.width / 2, y: bBox.y + bBox.height},
                            "N" : {x: bBox.x + bBox.width / 2, y: bBox.y}//,
                           /* "W" : {x: bBox.x, y: bBox.y + bBox.height / 2},
                            "E" : {x: bBox.x + bBox.width, y: bBox.y + bBox.height / 2}*/ };

            return result;
        };

        this.getConnectionPointsForPort = function (portId) {
            var resultCoord = {},
                connectionPointInPort,
                bBox = self.getBoundingBox(),
                portWidget = self.children[portId],
                portCoordinates;

            if (portWidget) {
                connectionPointInPort = portWidget.getConnectionPointCoordinate();
                portCoordinates = {  "x":  bBox.x + connectionPointInPort.x,
                                "y": bBox.y + connectionPointInPort.y };
                resultCoord[portWidget.getOrientation()] = portCoordinates;

                return resultCoord;
            }

            return {};
        };

        this.getConnections = function (includePortConnections) {
            var modelNode = self.project.getNode(self.getId()),
                connections = [],
                addConnectionsToList,
                itPort,
                port;

            addConnectionsToList = function (connList) {
                var i;

                for (i = 0; i < connList.length; i += 1) {
                    if (connections.indexOf(connList[i].id) === -1) {
                        connections.push(connList[i].id);
                    }
                }
            };

            //get the model's incoming and outgoing connections
            addConnectionsToList(modelNode.getConnectionList());

            //get the model's ports connections
            if (includePortConnections === true) {
                for (itPort in self.children) {
                    if (self.children.hasOwnProperty(itPort)) {
                        port = self.project.getNode(itPort);

                        if (port) {
                            //get the port's incoming and outgoing connections
                            addConnectionsToList(port.getConnectionList());
                        }
                    }
                }
            }


            return connections;
        };

        this.startPortConnection = function (portId) {
            logger.debug("start connection from port: " + portId);
            self.parentWidget.startDrawConnection(portId);
        };

        this.endPortConnection = function (portId) {
            self.parentWidget.endDrawConnection();
        };

        initialize();
    };

    return ModelEditorModelWidget2;
});