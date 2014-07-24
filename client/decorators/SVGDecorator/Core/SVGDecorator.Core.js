/*
 * Copyright (C) 2013 Vanderbilt University, All rights reserved.
 * 
 * Author: Robert Kereskenyi
 *
 * This file contains the core functionality for getting 
 * and rendering the svg
 */

"use strict";

define(['js/Constants',
        'js/NodePropertyNames',
        'js/RegistryKeys',
        'js/Utils/DisplayFormat',
        'js/Decorators/DecoratorWithPorts.Base',
        'js/Widgets/DiagramDesigner/DiagramDesignerWidget.Constants',
        'text!./default.svg'], function (CONSTANTS,
                                         nodePropertyNames,
                                         REGISTRY_KEYS,
                                         displayFormat,
                                         DecoratorBase,
                                         DiagramDesignerWidgetConstants,
                                         DefaultSvgTemplate) {

    var SVGDecoratorCore,
        ABSTRACT_CLASS = 'abstract',
        SVG_DIR = CONSTANTS.ASSETS_DECORATOR_SVG_FOLDER,
        FILL_COLOR_CLASS = "fill-color",
        BORDER_COLOR_CLASS = "border-color",
        TEXT_COLOR_CLASS = "text-color",
        DEFAULT_SVG_DEFAULT_HEIGHT = 50;


    /**
     * Contains downloaded svg elements from the server.
     * @type {{}}
     * @private
     */
    //var svgCache = {};

    /**
     * Svg element that can be used as a placeholder for the icon if the icon does not exist on the server.
     * @type {*|jQuery}
     * @private
     */
    var defaultSVG = $(DefaultSvgTemplate);


    SVGDecoratorCore = function () {
        DecoratorBase.apply(this, []);
    };

    _.extend(SVGDecoratorCore.prototype, DecoratorBase.prototype);

    SVGDecoratorCore.prototype._initializeVariables = function (params) {
        this.name = "";
        this.formattedName = "";
        this.$name = undefined;

        this.svgCache = {};
    };


    /**** Override from *.WidgetDecoratorBase ****/
    SVGDecoratorCore.prototype.doSearch = function (searchDesc) {
        var searchText = searchDesc.toString().toLowerCase();

        return (this.formattedName && this.formattedName.toLowerCase().indexOf(searchText) !== -1);
    };

    SVGDecoratorCore.prototype._renderContent = function () {
        //render GME-ID in the DOM, for debugging
        this.$el.attr({"data-id": this._metaInfo[CONSTANTS.GME_ID]});

        /* BUILD UI*/
        //find placeholders
        this.$name = this.$el.find(".name");
        this.$svgContent = this.$el.find(".svg-content");

		this._update();
    };
	
	SVGDecoratorCore.prototype._update = function () {
        this._updateSVGFile();
        this._updateColors();
        this._updateName();
        this._updateAbstract();
        this._updatePorts();//Will be overridden by ports class if extended
    };

    SVGDecoratorCore.prototype._updateColors = function () {
        var svg = this.$svgElement,
            fillColorElements = svg.find('.' + FILL_COLOR_CLASS),
            borderColorElements = svg.find('.' + BORDER_COLOR_CLASS),
            textColorElements = svg.find('.' + TEXT_COLOR_CLASS);

        this._getNodeColorsFromRegistry();

        if (this.fillColor) {
            fillColorElements.css({'fill': this.fillColor});
        } else {
            fillColorElements.css({'fill': ''});
        }

        if (this.borderColor) {
            borderColorElements.css({'stroke': this.borderColor});
        } else {
            borderColorElements.css({'stroke': ''});
        }

        if (this.textColor) {
            this.$el.css({'color': this.textColor});
            textColorElements.css({'fill': this.textColor});
        } else {
            this.$el.css({'color': ''});
            textColorElements.css({'fill': ''});
        }
    };

    SVGDecoratorCore.prototype._getNodeColorsFromRegistry = function () {
        var objID = this._metaInfo[CONSTANTS.GME_ID];
        this.fillColor = this.preferencesHelper.getRegistry(objID, REGISTRY_KEYS.COLOR, true);
        this.borderColor = this.preferencesHelper.getRegistry(objID, REGISTRY_KEYS.BORDER_COLOR, true);
        this.textColor = this.preferencesHelper.getRegistry(objID, REGISTRY_KEYS.TEXT_COLOR, true);
    };

    /***** UPDATE THE NAME OF THE NODE *****/
    SVGDecoratorCore.prototype._updateName = function () {
        var client = this._control._client,
            nodeObj = client.getNode(this._metaInfo[CONSTANTS.GME_ID]),
            noName = "(N/A)";

        if (nodeObj) {
            this.name = nodeObj.getAttribute(nodePropertyNames.Attributes.name);
            this.formattedName = displayFormat.resolve(nodeObj);
        } else {
            this.name = "";
            this.formattedName = noName;
        }

        this.$name.text(this.formattedName);
        this.$name.attr("title", this.formattedName);
    };

    /***** UPDATE THE ABSTRACTNESS OF THE NODE *****/
    SVGDecoratorCore.prototype._updateAbstract = function () {
        var client = this._control._client,
            nodeObj = client.getNode(this._metaInfo[CONSTANTS.GME_ID]);

        if (nodeObj) {
            if (nodeObj.getRegistry(REGISTRY_KEYS.IS_ABSTRACT) === true) {
                this.$el.addClass(ABSTRACT_CLASS);
            } else {
                this.$el.removeClass(ABSTRACT_CLASS);
            }
        } else {
            this.$el.removeClass(ABSTRACT_CLASS);
        }
    };

    /***** UPDATE THE SVG ICON OF THE NODE *****/
    SVGDecoratorCore.prototype._updateSVGFile = function () {
        var client = this._control._client,
            nodeObj = client.getNode(this._metaInfo[CONSTANTS.GME_ID]),
            svgFile = "",
            svgURL,
            self = this,
            logger = this.logger;

        if (nodeObj) {
            svgFile = nodeObj.getRegistry(REGISTRY_KEYS.SVG_ICON);
        }

        if (svgFile) {
            if (this._SVGFile !== svgFile) {
                if (this.svgCache[svgFile]) {
                    this._updateSVGContent(svgFile);
                } else {
                    // get the svg from the server in SYNC mode, may take some time
                    svgURL = SVG_DIR + svgFile;
                    $.ajax(svgURL, {'async': false})
                        .done(function ( data ) {
                            // downloaded successfully
                            // cache the content if valid
                            var svgElements = $(data).find('svg');
                            if (svgElements.length > 0) {
                                self.svgCache[svgFile] = { 'el': svgElements.first(),
                                                      'customConnectionAreas': undefined};
                                self._discoverCustomConnectionAreas(svgFile);
                                self._updateSVGContent(svgFile);
                            } else {
                                self._updateSVGContent(undefined);
                            }
                        })
                        .fail(function () {
                            // download failed for this type
                            logger.error('Failed to download SVG file: ' + svgFile);
                            self._updateSVGContent(svgFile);
                        });
                }
                this._SVGFile = svgFile;
            }
        } else {
            if (svgFile !== "") {
                logger.error('Invalid SVG file: "' + svgFile + '"');
                this._updateSVGContent(undefined);
            } else {
                this._updateSVGContent('');
            }
        }
    };

    SVGDecoratorCore.prototype._updateSVGContent = function (svg) {
        var svgIcon;
        //set new content
        this.$svgContent.empty();

        //remove existing connectors (if any)
        this.$el.find('> .' + DiagramDesignerWidgetConstants.CONNECTOR_CLASS).remove();

        this._defaultSVGUsed = false;

        if (this.svgCache[svg]) {
            svgIcon = this.svgCache[svg].el.clone();
        } else {
            svgIcon = defaultSVG.clone();
            if (svg !== '') {
                $(svgIcon.find('text')).html('!!! ' + svg + ' !!!');
            } else {
                this._defaultSVGUsed = true;
            }

        }

        this.$svgElement = svgIcon;
        this._getCustomConnectionAreas(svg);
        this._generateConnectors();

        this.$svgContent.append(svgIcon);
    };

    /***** FUNCTIONS TO OVERRIDE *****/

    SVGDecoratorCore.prototype._updateExtras = function () {
        //Can be overridden for custom functionality
    };

    SVGDecoratorCore.prototype._getCustomConnectionAreas = function (svgFile) {
        var connAreas = svgCache[svgFile] ? svgCache[svgFile].customConnectionAreas || [] : [],
            len = connAreas ? connAreas.length : 0,
            connA;

        delete this._customConnectionAreas;

        if (len > 0) {
            this._customConnectionAreas = [];

            while (len--) {
                connA = {};

                _.extend(connA, connAreas[len]);

                this._customConnectionAreas.push(connA);
            }
        }
    };

    SVGDecoratorCore.prototype._generateConnectors = function () {
        var svg = this.$svgElement,
            connectors = svg.find('.' + DiagramDesignerWidgetConstants.CONNECTOR_CLASS),
            c,
            svgWidth = parseInt(svg.attr('width'), 10),
            svgHeight = parseInt(svg.attr('height'), 10);

        if (this._displayConnectors === true) {
            //check if there are any connectors defined in the SVG itself
            if (connectors.length === 0) {
                //no dedicated connectors
                //by default generate four: N, S, E, W

                //NORTH
                c = CONNECTOR_BASE.clone();
                c.addClass('cn');
                c.css({'top': 0,
                       'left': svgWidth / 2});
                this.$el.append(c);

                //SOUTH
                c = CONNECTOR_BASE.clone();
                c.addClass('cs');
                c.css({'top': svgHeight,
                       'left': svgWidth / 2});
                this.$el.append(c);

                //EAST
                c = CONNECTOR_BASE.clone();
                c.addClass('ce');
                c.css({'top': svgHeight / 2,
                       'left': svgWidth});
                this.$el.append(c);

                //WEST
                c = CONNECTOR_BASE.clone();
                c.addClass('cw');
                c.css({'top': svgHeight / 2,
                    'left': 0});
                this.$el.append(c);
            }

            this.initializeConnectors();
        } else {
            connectors.remove();
        }
    };


    /***** UPDATE THE PORTS OF THE NODE *****/
    SVGDecoratorCore.prototype._updatePorts = function () {
        //If no ports in model, does nothing
    };

    SVGDecoratorCore.prototype._fixPortContainerPosition = function () {
        //If no ports in model, does nothing
    };

    /***** CONNECTION FUNCTIONALITY *****/
    //Overridden in SVGDecorator.Connection.js 
    SVGDecoratorCore.prototype._discoverCustomConnectionAreas = function () {
        //If no connections in model, does nothing
    };

    SVGDecoratorCore.prototype._getCustomConnectionAreas = function () {
        //If no connections in model, does nothing
    };

    //Overridden in SVGDecorator.Connection.js 
    SVGDecoratorCore.prototype._generateConnectors = function () {
        //If no connections in model, does nothing
    };

    return SVGDecoratorCore;
});
