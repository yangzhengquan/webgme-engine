/*globals define, console*/
/*eslint-env browser*/

/**
 * @author kecso / https://github.com/kecso
 * @author pmeijer / https://github.com/pmeijer
 */

define(['common/storage/constants'], function (CONSTANTS) {
    'use strict';
    class WebsocketRouterAccessClient {
        constructor(routerId, send, connectReceiveFunctions) {
            this._id = routerId;
            this._send = send;
            this._isConnected = false;
            const handleObject = {};
            handleObject[CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE] = (payload) => {
                this._onDisconnectHandle(payload);
            };
            handleObject[CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT] = (payload) => {
                this._onDisconnectHandle(payload);
            }; 

            connectReceiveFunctions(this._id, handleObject);
        }

        connect(callback) {
            this._send(this._id, CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.CONNECT, null, (err, data) => {
                if (!err) {
                    this._isConnected = true;
                }
                callback(err, data);
            });
        }

        send(payload, callback) {
            this._send(this._id, CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE, payload, callback);
        }

        disconnect(reason, callback) {
            this._isConnected = false;
            this._send(this._id, CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT, reason, callback);
        }

        onMessage(handleFn) {
            this._onMessageHandle = handleFn;
        }

        onDisconnect(handleFn) {
            this._onDisconnectHandle = handleFn;
        }

        isConnected() {
            return this._isConnected;
        }
    }

    /**
     * @param {string} _id - Path of node.
     * @param {GmeLogger} logger - logger.
     * @param {object} state - state of the client.
     * @param {function} storeNode - invoked when storing new nodes.
     * @constructor
     */
    function WebsocketRouterAccess(logger, client, storage) {
        const routers = {};
        const handles = {};

        function send(routerId, messageType, payload, callback) {
            logger.debug('outgoing message to websocket router',
                {metadata: {routerId: routerId, messageType: messageType, payload: payload}});
            storage.sendWsRouterMessage(routerId, messageType, payload, callback);
        }

        function connectHandles(routerId, handles) {
            logger.debug('access binding [' +  routerId + ']');
            handles[routerId] = handles;
        }

        function processMessage(routerId, messageType, payload) {
            if (handles[routerId] && routers[routerId]) {
                switch (messageType) {
                    case CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.MESSAGE:
                    case CONSTANTS.WEBSOCKET_ROUTER_MESSAGE_TYPES.DISCONNECT:
                        logger.debug('incoming message from websocket router',
                            {metadata: {routerId: routerId, messageType: messageType, payload: payload}});
                        handles[routerId][messageType](payload);
                        return;
                }
            }
            logger.debug('bad incoming message from websocket router',
                {metadata: {routerId: routerId, messageType: messageType, payload: payload}});
        }

        function getWebsocketRouterAccess(routerId) {
            logger.debug('getting websocket router access [' + routerId + ']');
            if (routers[routerId]) {
                return routers[routerId];
            } 
            
            routers[routerId] = new WebsocketRouterAccessClient(routerId, send, connectHandles);
            return routers[routerId];
        }


        storage.onWebsocketRouterMessage(processMessage);
        
        return {
            getWebsocketRouterAccess: getWebsocketRouterAccess
        };
    }

    return WebsocketRouterAccess;
});
