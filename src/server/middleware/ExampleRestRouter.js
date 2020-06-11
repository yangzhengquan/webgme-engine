/*eslint-env node*/
/**
 * To use in the server add the following to the gme config;
 * gmeConfig.rest.component['path/subPath'] = './middleware/ExampleRestRouter'.
 * It will the expose, e.g. GET <host>/path/subPath/getExample, when running the server.
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

// http://expressjs.com/en/guide/routing.html
var express = require('express'),
    router = express.Router();

const WebsocketRouter = require('./websocket-router/WebsocketRouter');
let pingTimer = null;
let wsRouter = null;
let websocket = null;
/**
 * Called when the server is created but before it starts to listening to incoming requests.
 * N.B. gmeAuth, safeStorage and workerManager are not ready to use until the start function is called.
 * (However inside an incoming request they are all ensured to have been initialized.)
 *
 * @param {object} middlewareOpts - Passed by the webgme server.
 * @param {GmeConfig} middlewareOpts.gmeConfig - GME config parameters.
 * @param {GmeLogger} middlewareOpts.logger - logger
 * @param {function} middlewareOpts.ensureAuthenticated - Ensures the user is authenticated.
 * @param {function} middlewareOpts.getUserId - If authenticated retrieves the userId from the request.
 * @param {object} middlewareOpts.gmeAuth - Authorization module.
 * @param {object} middlewareOpts.safeStorage - Accesses the storage and emits events (PROJECT_CREATED, COMMIT..).
 * @param {object} middlewareOpts.workerManager - Spawns and keeps track of "worker" sub-processes.
 */
function initialize(middlewareOpts) {
    var logger = middlewareOpts.logger.fork('ExampleRestRouter'),
        ensureAuthenticated = middlewareOpts.ensureAuthenticated,
        getUserId = middlewareOpts.getUserId;

    websocket = middlewareOpts.webSocket;

    logger.debug('initializing ...');

    // Ensure authenticated can be used only after this rule.
    router.use('*', function (req, res, next) {
        // TODO: set all headers, check rate limit, etc.

        // This header ensures that any failures with authentication won't redirect.
        res.setHeader('X-WebGME-Media-Type', 'webgme.v1');
        next();
    });

    // Use ensureAuthenticated if the routes require authentication. (Can be set explicitly for each route.)
    router.use('*', ensureAuthenticated);

    router.get('/getExample', function (req, res/*, next*/) {
        var userId = getUserId(req);

        res.json({userId: userId, message: 'get request was handled'});
    });

    router.patch('/patchExample', function (req, res/*, next*/) {
        res.sendStatus(200);
    });


    router.post('/postExample', function (req, res/*, next*/) {
        res.sendStatus(201);
    });

    router.delete('/deleteExample', function (req, res/*, next*/) {
        res.sendStatus(204);
    });

    router.get('/error', function (req, res, next) {
        next(new Error('error example'));
    });

    logger.debug('ready');
}

/**
 * Called before the server starts listening.
 * @param {function} callback
 */
function start(callback) {
    wsRouter = new WebsocketRouter(websocket, 'ExampleRestRouter');


    wsRouter.onConnect((user, callback) => {
        let pongTimer = setInterval(() => {
            user.send('ping-ping');
        }, 50);

        user.onMessage((payload, callback) => {
            logger.debug('message arrived', payload);
            if (payload === 'ping') {
                callback(null, 'pong');
            } else {
                callback(new Error('unknown message'));
            }
        });

        user.onDisconnect((cause, callback) => {
            logger.debug('user disconnected...', cause);
            clearInterval(pongTimer);
            callback(null);
        });

        callback(null);
    });
    pingTimer = setInterval(() => {
        if (wsRouter) {
            wsRouter.send('ping');
        }
    }, 100);

    callback();
}

/**
 * Called after the server stopped listening.
 * @param {function} callback
 */
function stop(callback) {
    if (pingTimer) {
        clearInterval(pingTimer);
        wsRouter.disconnect(new Error('shutting down...'));
    }
    callback();
}


module.exports = {
    initialize: initialize,
    router: router,
    start: start,
    stop: stop
};