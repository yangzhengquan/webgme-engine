/*globals define*/
/*jshint node: true, browser: true*/

/**
 * @author kecso / https://github.com/kecso
 */

define(['common/util/assert', 'common/core/tasync'], function (ASSERT, TASYNC) {
    'use strict';

    // ----------------- CoreTreeLoader -----------------

    var MetaCore = function (innerCore, options) {
        ASSERT(typeof options === 'object');
        ASSERT(typeof options.globConf === 'object');
        ASSERT(typeof options.logger !== 'undefined');
        var core = {},
            key,
            logger = options.logger.fork('coretreeloader');
        for (key in innerCore) {
            core[key] = innerCore[key];
        }
        logger.debug('initialized');
        //adding load functions
        var loadSubTree = function (root, own) {
            var loadSubTrees = function (nodes) {
                    for (var i = 0; i < nodes.length; i++) {
                        nodes[i] = core.loadSubTree(nodes[i], own);
                    }
                    return TASYNC.lift(nodes);

                },
                childLoading = own === true ? core.loadOwnChildren : core.loadChildren;
            return TASYNC.call(function (children) {
                if (children.length < 1) {
                    return [root];
                } else {
                    return TASYNC.call(function (subArrays) {
                        var nodes = [],
                            i;
                        for (i = 0; i < subArrays.length; i++) {
                            nodes = nodes.concat(subArrays[i]);
                        }
                        nodes.unshift(root);
                        return nodes;
                    }, loadSubTrees(children));
                }
            }, childLoading(root));
        };

        core.loadTree = function (rootHash) {
            return TASYNC.call(core.loadSubTree, core.loadRoot(rootHash));
        };

        core.loadSubTree = function (root) {
            return loadSubTree(root, false);
        };

        core.loadOwnSubTree = function (root) {
            return loadSubTree(root, true);
        };

        return core;
    };
    return MetaCore;
});
