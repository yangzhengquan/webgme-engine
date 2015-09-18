/* Generated file based on ejs templates */
define([], function() {
    return {
    "Control.js.ejs": "/*globals define, WebGMEGlobal*/\n/*jshint browser: true*/\n/**\n * Generated by VisualizerGenerator <%= version %> from webgme on <%= date %>.\n */\n\ndefine(['js/Constants',\n    'js/Utils/GMEConcepts',\n    'js/NodePropertyNames'\n], function (CONSTANTS,\n             GMEConcepts,\n             nodePropertyNames) {\n\n    'use strict';\n\n    var <%= visualizerID %>Control;\n\n    <%= visualizerID %>Control = function (options) {\n\n        this._logger = options.logger.fork('Control');\n\n        this._client = options.client;\n\n        // Initialize core collections and variables\n        this._widget = options.widget;\n\n        this._currentNodeId = null;\n        this._currentNodeParentId = undefined;\n\n        this._initWidgetEventHandlers();\n\n        this._logger.debug('ctor finished');\n    };\n\n    <%= visualizerID %>Control.prototype._initWidgetEventHandlers = function () {\n        this._widget.onNodeClick = function (id) {\n            // Change the current active object\n            WebGMEGlobal.State.registerActiveObject(id);\n        };\n    };\n\n    /* * * * * * * * Visualizer content update callbacks * * * * * * * */\n    // One major concept here is with managing the territory. The territory\n    // defines the parts of the project that the visualizer is interested in\n    // (this allows the browser to then only load those relevant parts).\n    <%= visualizerID %>Control.prototype.selectedObjectChanged = function (nodeId) {\n        var desc = this._getObjectDescriptor(nodeId),\n            self = this;\n\n        self._logger.debug('activeObject nodeId \\'' + nodeId + '\\'');\n\n        // Remove current territory patterns\n        if (self._currentNodeId) {\n            self._client.removeUI(self._territoryId);\n        }\n\n        self._currentNodeId = nodeId;\n        self._currentNodeParentId = undefined;\n\n        if (self._currentNodeId || self._currentNodeId === CONSTANTS.PROJECT_ROOT_ID) {\n            // Put new node's info into territory rules\n            self._selfPatterns = {};\n            self._selfPatterns[nodeId] = {children: 0};  // Territory \"rule\"\n\n            self._widget.setTitle(desc.name.toUpperCase());\n\n            if (desc.parentId || desc.parentId === CONSTANTS.PROJECT_ROOT_ID) {\n                self.$btnModelHierarchyUp.show();\n            } else {\n                self.$btnModelHierarchyUp.hide();\n            }\n\n            self._currentNodeParentId = desc.parentId;\n\n            self._territoryId = self._client.addUI(self, function (events) {\n                self._eventCallback(events);\n            });\n\n            // Update the territory\n            self._client.updateTerritory(self._territoryId, self._selfPatterns);\n\n            self._selfPatterns[nodeId] = {children: 1};\n            self._client.updateTerritory(self._territoryId, self._selfPatterns);\n        }\n    };\n\n    // This next function retrieves the relevant node information for the widget\n    <%= visualizerID %>Control.prototype._getObjectDescriptor = function (nodeId) {\n        var nodeObj = this._client.getNode(nodeId),\n            objDescriptor;\n\n        if (nodeObj) {\n            objDescriptor = {\n                'id': undefined,\n                'name': undefined,\n                'childrenIds': undefined,\n                'parentId': undefined,\n                'isConnection': false\n            };\n\n            objDescriptor.id = nodeObj.getId();\n            objDescriptor.name = nodeObj.getAttribute(nodePropertyNames.Attributes.name);\n            objDescriptor.childrenIds = nodeObj.getChildrenIds();\n            objDescriptor.childrenNum = objDescriptor.childrenIds.length;\n            objDescriptor.parentId = nodeObj.getParentId();\n            objDescriptor.isConnection = GMEConcepts.isConnection(nodeId);  // GMEConcepts can be helpful\n        }\n\n        return objDescriptor;\n    };\n\n    /* * * * * * * * Node Event Handling * * * * * * * */\n    <%= visualizerID %>Control.prototype._eventCallback = function (events) {\n        var i = events ? events.length : 0,\n            event;\n\n        this._logger.debug('_eventCallback \\'' + i + '\\' items');\n\n        while (i--) {\n            event = events[i];\n            switch (event.etype) {\n                case CONSTANTS.TERRITORY_EVENT_LOAD:\n                    this._onLoad(event.eid);\n                    break;\n                case CONSTANTS.TERRITORY_EVENT_UPDATE:\n                    this._onUpdate(event.eid);\n                    break;\n                case CONSTANTS.TERRITORY_EVENT_UNLOAD:\n                    this._onUnload(event.eid);\n                    break;\n                default:\n                    break;\n            }\n        }\n\n        this._logger.debug('_eventCallback \\'' + events.length + '\\' items - DONE');\n    };\n\n    <%= visualizerID %>Control.prototype._onLoad = function (gmeId) {\n        var description = this._getObjectDescriptor(gmeId);\n        this._widget.addNode(description);\n    };\n\n    <%= visualizerID %>Control.prototype._onUpdate = function (gmeId) {\n        var description = this._getObjectDescriptor(gmeId);\n        this._widget.updateNode(description);\n    };\n\n    <%= visualizerID %>Control.prototype._onUnload = function (gmeId) {\n        this._widget.removeNode(gmeId);\n    };\n\n    <%= visualizerID %>Control.prototype._stateActiveObjectChanged = function (model, activeObjectId) {\n        this.selectedObjectChanged(activeObjectId);\n    };\n\n    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */\n    <%= visualizerID %>Control.prototype.destroy = function () {\n        this._detachClientEventListeners();\n        this._removeToolbarItems();\n    };\n\n    <%= visualizerID %>Control.prototype._attachClientEventListeners = function () {\n        this._detachClientEventListeners();\n        WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);\n    };\n\n    <%= visualizerID %>Control.prototype._detachClientEventListeners = function () {\n        WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);\n    };\n\n    <%= visualizerID %>Control.prototype.onActivate = function () {\n        this._attachClientEventListeners();\n        this._displayToolbarItems();\n    };\n\n    <%= visualizerID %>Control.prototype.onDeactivate = function () {\n        this._detachClientEventListeners();\n        this._hideToolbarItems();\n    };\n\n    /* * * * * * * * * * Updating the toolbar * * * * * * * * * */\n    <%= visualizerID %>Control.prototype._displayToolbarItems = function () {\n\n        if (this._toolbarInitialized === true) {\n            for (var i = this._toolbarItems.length; i--;) {\n                this._toolbarItems[i].show();\n            }\n        } else {\n            this._initializeToolbar();\n        }\n    };\n\n    <%= visualizerID %>Control.prototype._hideToolbarItems = function () {\n\n        if (this._toolbarInitialized === true) {\n            for (var i = this._toolbarItems.length; i--;) {\n                this._toolbarItems[i].hide();\n            }\n        }\n    };\n\n    <%= visualizerID %>Control.prototype._removeToolbarItems = function () {\n\n        if (this._toolbarInitialized === true) {\n            for (var i = this._toolbarItems.length; i--;) {\n                this._toolbarItems[i].destroy();\n            }\n        }\n    };\n\n    <%= visualizerID %>Control.prototype._initializeToolbar = function () {\n        var self = this,\n            toolBar = WebGMEGlobal.Toolbar;\n\n        this._toolbarItems = [];\n\n        this._toolbarItems.push(toolBar.addSeparator());\n\n        /************** Go to hierarchical parent button ****************/\n        this.$btnModelHierarchyUp = toolBar.addButton({\n            title: 'Go to parent',\n            icon: 'glyphicon glyphicon-circle-arrow-up',\n            clickFn: function (/*data*/) {\n                WebGMEGlobal.State.registerActiveObject(self._currentNodeParentId);\n            }\n        });\n        this._toolbarItems.push(this.$btnModelHierarchyUp);\n        this.$btnModelHierarchyUp.hide();\n\n        /************** Checkbox example *******************/\n\n        this.$cbShowConnection = toolBar.addCheckBox({\n            title: 'toggle checkbox',\n            icon: 'gme icon-gme_diagonal-arrow',\n            checkChangedFn: function (data, checked) {\n                self._logger.log('Checkbox has been clicked!');\n            }\n        });\n        this._toolbarItems.push(this.$cbShowConnection);\n\n        this._toolbarInitialized = true;\n    };\n\n    return <%= visualizerID %>Control;\n});\n",
    "Panel.js.ejs": "/*globals define, _, WebGMEGlobal*/\n/*jshint browser: true*/\n/**\n * Generated by VisualizerGenerator <%= version %> from webgme on <%= date %>.\n */\n\ndefine(['js/PanelBase/PanelBaseWithHeader',\n    'js/PanelManager/IActivePanel',\n    'js/Widgets/<%= visualizerID %>/<%= visualizerID %>Widget',\n    './<%= visualizerID %>Control'\n], function (PanelBaseWithHeader,\n             IActivePanel,\n             <%= visualizerID %>Widget,\n             <%= visualizerID %>Control) {\n    'use strict';\n\n    var <%= visualizerID %>Panel;\n\n    <%= visualizerID %>Panel = function (layoutManager, params) {\n        var options = {};\n        //set properties from options\n        options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = '<%= visualizerID %>Panel';\n        options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;\n\n        //call parent's constructor\n        PanelBaseWithHeader.apply(this, [options, layoutManager]);\n\n        this._client = params.client;\n\n        //initialize UI\n        this._initialize();\n\n        this.logger.debug('ctor finished');\n    };\n\n    //inherit from PanelBaseWithHeader\n    _.extend(<%= visualizerID %>Panel.prototype, PanelBaseWithHeader.prototype);\n    _.extend(<%= visualizerID %>Panel.prototype, IActivePanel.prototype);\n\n    <%= visualizerID %>Panel.prototype._initialize = function () {\n        var self = this;\n\n        //set Widget title\n        this.setTitle('');\n\n        this.widget = new <%= visualizerID %>Widget(this.logger, this.$el);\n\n        this.widget.setTitle = function (title) {\n            self.setTitle(title);\n        };\n\n        this.control = new <%= visualizerID %>Control({\n            logger: this.logger,\n            client: this._client,\n            widget: this.widget\n        });\n\n        this.onActivate();\n    };\n\n    /* OVERRIDE FROM WIDGET-WITH-HEADER */\n    /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */\n    <%= visualizerID %>Panel.prototype.onReadOnlyChanged = function (isReadOnly) {\n        //apply parent's onReadOnlyChanged\n        PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);\n\n    };\n\n    <%= visualizerID %>Panel.prototype.onResize = function (width, height) {\n        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);\n        this.widget.onWidgetContainerResize(width, height);\n    };\n\n    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */\n    <%= visualizerID %>Panel.prototype.destroy = function () {\n        this.control.destroy();\n        this.widget.destroy();\n\n        PanelBaseWithHeader.prototype.destroy.call(this);\n        WebGMEGlobal.KeyboardManager.setListener(undefined);\n        WebGMEGlobal.Toolbar.refresh();\n    };\n\n    <%= visualizerID %>Panel.prototype.onActivate = function () {\n        this.widget.onActivate();\n        this.control.onActivate();\n        WebGMEGlobal.KeyboardManager.setListener(this.widget);\n        WebGMEGlobal.Toolbar.refresh();\n    };\n\n    <%= visualizerID %>Panel.prototype.onDeactivate = function () {\n        this.widget.onDeactivate();\n        this.control.onDeactivate();\n        WebGMEGlobal.KeyboardManager.setListener(undefined);\n        WebGMEGlobal.Toolbar.refresh();\n    };\n\n    return <%= visualizerID %>Panel;\n});\n",
    "Widget.js.ejs": "/*globals define, WebGMEGlobal*/\n/*jshint browser: true*/\n\n/**\n * Generated by VisualizerGenerator <%= version %> from webgme on <%= date %>.\n */\n\ndefine(['css!./styles/<%= visualizerID %>Widget.css'], function () {\n    'use strict';\n\n    var <%= visualizerID %>Widget,\n        WIDGET_CLASS = '<%= widgetClass %>';\n\n    <%= visualizerID %>Widget = function (logger, container) {\n        this._logger = logger.fork('Widget');\n\n        this._el = container;\n\n        this.nodes = {};\n        this._initialize();\n\n        this._logger.debug('ctor finished');\n    };\n\n    <%= visualizerID %>Widget.prototype._initialize = function () {\n        var width = this._el.width(),\n            height = this._el.height(),\n            self = this;\n\n        // set widget class\n        this._el.addClass(WIDGET_CLASS);\n\n        // Create a dummy header \n        this._el.append('<h3><%= visualizerID %> Events:</h3>');\n\n        // Registering to events can be done with jQuery (as normal)\n        this._el.on('dblclick', function (event) {\n            event.stopPropagation();\n            event.preventDefault();\n            self.onBackgroundDblClick();\n        });\n    };\n\n    <%= visualizerID %>Widget.prototype.onWidgetContainerResize = function (width, height) {\n        console.log('Widget is resizing...');\n    };\n\n    // Adding/Removing/Updating items\n    <%= visualizerID %>Widget.prototype.addNode = function (desc) {\n        if (desc) {\n            // Add node to a table of nodes\n            var node = document.createElement('div'),\n                label = 'children';\n\n            if (desc.childrenIds.length === 1) {\n                label = 'child';\n            }\n\n            this.nodes[desc.id] = desc;\n            node.innerHTML = 'Adding node \"' + desc.name + '\" (click to view). It has ' + \n                desc.childrenIds.length + ' ' + label + '.';\n\n            this._el.append(node);\n            node.onclick = this.onNodeClick.bind(this, desc.id);\n        }\n    };\n\n    <%= visualizerID %>Widget.prototype.removeNode = function (gmeId) {\n        var desc = this.nodes[gmeId];\n        this._el.append('<div>Removing node \"'+desc.name+'\"</div>');\n        delete this.nodes[gmeId];\n    };\n\n    <%= visualizerID %>Widget.prototype.updateNode = function (desc) {\n        if (desc) {\n            console.log('Updating node:', desc);\n            this._el.append('<div>Updating node \"'+desc.name+'\"</div>');\n        }\n    };\n\n    /* * * * * * * * Visualizer event handlers * * * * * * * */\n\n    <%= visualizerID %>Widget.prototype.onNodeClick = function (id) {\n        // This currently changes the active node to the given id and\n        // this is overridden in the controller.\n    };\n\n    <%= visualizerID %>Widget.prototype.onBackgroundDblClick = function () {\n        this._el.append('<div>Background was double-clicked!!</div>');\n    };\n\n    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */\n    <%= visualizerID %>Widget.prototype.destroy = function () {\n    };\n\n    <%= visualizerID %>Widget.prototype.onActivate = function () {\n        console.log('<%= visualizerID %>Widget has been activated');\n    };\n\n    <%= visualizerID %>Widget.prototype.onDeactivate = function () {\n        console.log('<%= visualizerID %>Widget has been deactivated');\n    };\n\n    return <%= visualizerID %>Widget;\n});\n",
    "styles/Styles.css.ejs": "/**\n * This file is for any css that you may want for this visualizer.\n *\n * Ideally, you would use the scss file also provided in this directory \n * and then generate this file automatically from that. However, you can \n * simply write css if you prefer\n */\n\n.<%= widgetClass %> {\n  outline: none; }\n",
    "styles/Styles.scss.ejs": "/**\n * This file is for any scss that you may want for this visualizer.\n */\n\n.<%= widgetClass %> {\n  outline: none;\n}\n"
}});