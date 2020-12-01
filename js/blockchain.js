//external modules
var CryptoJS = require('crypto-js');
var webSocket = require('ws');
var path = require('path');
var fs = require('fs');
var chalk = require('chalk');

//ssl
var key = fs.readFileSync(path.join(__dirname + '/../ssl/private.key'));
var cert = fs.readFileSync(path.join(__dirname + '/../ssl/private.crt'));

//aes-mac
var macKey = fs.readFileSync(path.join(__dirname + '/../ssl/blockchain.key')).toString();

/*
    block
*/
//block of blockchain
function block(index, prevHash, time, data, hash) {
    this.index = index;
    this.prevHash = prevHash;
    this.time = time;
    this.data = data;
    this.hash = hash;
}

/*
    block data
*/
//data for block of blockchain
function blockData(uid, eleid, conid, parid) {
    this.uid = uid;
    this.eleid = eleid;
    this.conid = conid;
    this.parid = parid;
}

/*
    blockchain
*/
//calculate hash of block
function blockHash(block) {
    return genHash(block.data);
}

//generate Hash of block
function genHash(data) {
    return CryptoJS.SHA256(data.uid + data.eleid).toString();
}

//block 0
function setGenBlock() {
    return new block(0, "0", 0, new blockData(0,0,0,0), CryptoJS.SHA256(0).toString());
}

//variable
var blockchain = [setGenBlock()];

//get last blocks
function getLastBlock() {
    return blockchain[blockchain.length - 1];
};

//generate blocks
function genBlocks(uid, eleid, conid, parid) {
    var index = getLastBlock().index + 1;
    var prevHash = getLastBlock().hash;
    var time = Math.round(new Date().getTime()/1000);
    uid = CryptoJS.HmacSHA512(uid,macKey).toString();
    var data = new blockData(uid, eleid, conid, parid);
    var hash = genHash(data);
    return new block(index, prevHash, time, data, hash);
}

//validate block added to blockchain
function isValidBlock(newBlock, prevBlock) {
    if (prevBlock.index + 1 !== newBlock.index) {
        console.log(chalk.bold.magenta("indexNotMatchError"));
        return false;
    } else if (prevBlock.hash !== newBlock.prevHash) {
        console.log(chalk.bold.magenta("prevHashNotMatchError"));
        return false;
    } else if (blockHash(newBlock) !== newBlock.hash) {
        console.log(chalk.bold.magenta("hashMismatchError"));
        return false;
    }
    return true;
}

//check if hash has repeated
function isHashRepeated(newBlock) {
    for(var i=1;i<blockchain.length;i++) {
        if(blockchain[i].hash ===  newBlock.hash) {
            return true;
        }
    }
    return false;
}

//add block to blockchain
function addBlock(newBlock) {
    if (isValidBlock(newBlock, getLastBlock()) && !isHashRepeated(newBlock)) {
        blockchain.push(newBlock);
        return true;
    }
    return false;
}

//validate chain
function isValidChain(chain) {
    if (JSON.stringify(chain[0]) !== JSON.stringify(setGenBlock())) {
        return false;
    }
    var tempChain = [chain[0]];
    for (var i = 1; i < chain.length; i++) {
        if (isValidBlock(chain[i], tempChain[i - 1])) {
            tempChain.push(chain[i]);
        } else {
            return false;
        }
    }
    return true;
}

//get blockchain
function getChain() {
    return blockchain;
}

//long chain rule
function replaceChain(chain) {
    if (isValidChain(chain) && chain.length > blockchain.length) {
        blockchain = chain;
        console.log(chalk.bold.magenta("fetchingLongerChain"));
        broadcast(responseLatestMsg());
    } else {
        console.log(chalk.bold.magenta("fetchChainError"));
    }
}

/*
    messageType
*/
//constants
const QUERY_LATEST = 0;
const QUERY_ALL = 1;
const RESPONSE_BLOCKCHAIN = 2;

/*
    message
*/
//ask peer for latest block
function queryChainLengthMsg() {
    return {
        'type': QUERY_LATEST
    }
}

//ask peer for entire blockchain
function queryAllMsg() {
    return {
        'type': QUERY_ALL
    }
}

//send peer entire blockchain
function responseChainMsg() {
    return {
        'type': RESPONSE_BLOCKCHAIN,
        'data': JSON.stringify(getChain())
    }
}

//send peer latest block
function responseLatestMsg() {
    return {
        'type': RESPONSE_BLOCKCHAIN,
        'data': JSON.stringify([getLastBlock()])
    }
}

/*
    sockets
*/
//variable
var sockets = [];
var socketsAddr = [];

//P2P server
function server(ip, ipPort) {
    //var server = new webSocket.Server({ port: ipPort, host: ip });
    var server = new webSocket.Server({ port: ipPort, host: ip, cert: cert, key: key });
    server.on('connection', ws => initConnection(ws));
    console.log(chalk.bold.red('Your p2p socket is ws://' + ip + ':' + ipPort));
}

//init Connection
function initConnection(ws) {
    var addr = "ws://"+ws._socket.remoteAddress+":"+ws._socket.remotePort;
    console.log(chalk.bold.yellow("Client "+addr+" connected!"));
    socketsAddr.push(addr);
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());
}

//connecting peers
function connectToPeer(newPeer) {
    console.log(chalk.bold.yellow("Connecting to "+newPeer));
    var ws = new webSocket(newPeer);
    ws.on('open', () => initConnection(ws));
    ws.on('error', () => {
        console.log(chalk.bold.yellow('Peer connection failed!'));
    });
}

//write message
function write(ws, msg) {
    ws.send(JSON.stringify(msg));
}

//broadcast message
function broadcast(msg) {
    sockets.forEach(socket => write(socket, msg));
}

//message handler
function initMessageHandler(ws) {
    ws.on('message', (data) => {
        var msg = JSON.parse(data);
        console.log(chalk.bold.gray('Incoming Message:' + JSON.stringify(msg)));
        switch (msg.type) {
            case QUERY_LATEST:
                write(ws, responseLatestMsg());
                break;
            case QUERY_ALL:
                write(ws, responseChainMsg());
                break;
            case RESPONSE_BLOCKCHAIN:
                handleBlockchainResponse(msg);
                break;
        }
    });
}

//error handler
function initErrorHandler(ws) {
    var closeConnection = (ws) => {
        var peer;
        if (ws.url === undefined) {
            var client = socketsAddr[sockets.indexOf(ws)];
            peer = 'Client '+client+' disconnected!';
        } else {
            peer = 'Disconnecting from ' + ws.url;
        }
        console.log(chalk.bold.yellow(peer));
        socketsAddr.splice(socketsAddr.indexOf(ws),1);
        sockets.splice(sockets.indexOf(ws), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
}

//handle blockchain response
function handleBlockchainResponse(message) {
    var receivedBlocks = JSON.parse(message.data).sort((b1, b2) => (b1.index - b2.index));
    var latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    var latestBlockHeld = getLastBlock();
    if (latestBlockReceived.index > latestBlockHeld.index) {
        console.log(chalk.bold.magenta('blockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index));
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            console.log(chalk.bold.magenta("We can append the received block to our chain"));
            blockchain.push(latestBlockReceived);
            broadcast(responseLatestMsg());
        } else if (receivedBlocks.length === 1) {
            console.log(chalk.bold.magenta("We have to query the chain from our peer"));
            broadcast(queryAllMsg());
        } else {
            console.log(chalk.bold.magenta("Received blockchain is longer than current blockchain"));
            replaceChain(receivedBlocks);
        }
    } else {
        console.log(chalk.bold.magenta('received blockchain is not longer than received blockchain. Do nothing'));
    }
}

//disconnecting all peers
function closeSockets() {
    sockets.forEach(function(s) {
        var i = sockets.indexOf(s);
        console.log(chalk.bold.yellow("Disconnecting from "+socketsAddr[i]));
        s.terminate();
        socketsAddr.splice(socketsAddr[i],1);
        sockets.splice(sockets[i], 1);
    })
}

//export
module.exports = {
    server: server,
    connectToPeer: connectToPeer,
    closeSockets: closeSockets,
    getChain: getChain,
    genBlocks: genBlocks,
    isHashRepeated: isHashRepeated,
    addBlock: addBlock,
    broadcast: broadcast,
    responseLatestMsg: responseLatestMsg
};