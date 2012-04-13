







/*MAIN*/
var io = require('socket.io-client');

var socket = io.connect('http://localhost:8081');
socket.on('connect', function(){
    console.log("connect");
    socket.emit('authenticate',{login:"kecso",pwd:"turoburo"});
});
socket.on('authenticateAck', function(){
    console.log("authenticateAck");
    socket.emit('listProjects');
});
socket.on('listProjectsAck',function(msg){
    console.log("listProjectsAck "+JSON.stringify(msg));
    socket.emit('createProject',"testproject");
});
socket.on('createProjectNack',function(msg){
    console.log("createProjectNack");
    socket.emit('selectProject',"testproject")
});
socket.on('createProjectAck',function(msg){
    console.log("Ack");
    process.exit(0);
});
socket.on('listBranchesAck',function(msg){
    console.log("listBranchesAck "+JSON.stringify(msg));
    socket.emit('createBranch',"test");
});
socket.on('selectProjectAck',function(msg){
    console.log("selectProjectAck");
    socket.emit('listBranches');
});
socket.on('selectProjectNack',function(msg){
    console.log("selectProjectNack");
    process.exit(0);
});
socket.on('createBranchAck',function(msg){
    console.log("createBranchAck");
    process.exit(0);
});
socket.on('createBranchNack',function(msg){
    console.log("createBranchNack");
    socket.emit('connectToBranch',"test");
});
socket.on('connectToBranchAck',function(msg){
    console.log("selectBranchAck");
    process.exit(0);
});
socket.on('connectToBranchNack',function(msg){
    console.log("selectBranchNack");
    process.exit(0);
});

