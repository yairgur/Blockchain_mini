const { createContext, CryptoFactory } = require("sawtooth-sdk/signing");
const crypto = require("crypto");
const { protobuf } = require("sawtooth-sdk");
const fetch = require("node-fetch");
const context = createContext("secp256k1");
const { TextEncoder, TextDecoder } = require("text-encoding/lib/encoding");
const privateKey = context.newRandomPrivateKey();
const cryptoFact = new CryptoFactory(context);
const signer = cryptoFact.newSigner(privateKey);
const { createHash } = require('crypto')

const FAMILY = "vaccine";

const getAddress = (key, length = 64) => {
    return createHash('sha512').update(key).digest('hex').slice(0, length)
}

const getVacAddress = name => PREFIX + getAddress(name, 58)

const PREFIX = getAddress(FAMILY, 6)

function getRandom20LenString() {
  var result           = '';
  var characters       = '0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < 20; i++ ) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const myVacId = getRandom20LenString();

const tempThresh =  70;

const createTransaction = (payload,vacId) => {
  const encoder = new TextEncoder("utf8");
  const payloadBytes = encoder.encode(payload);
  const transactionHeaderBytes = protobuf.TransactionHeader.encode({
    familyName: FAMILY,
    familyVersion: "1.0",
    inputs: [getVacAddress(vacId)],
    outputs: [getVacAddress(vacId)],
    signerPublicKey: signer.getPublicKey().asHex(),
    batcherPublicKey: signer.getPublicKey().asHex(),
    dependencies: [],
    nonce: "" + Math.random(),
    payload_encoding: "utf8",
    payloadSha512: crypto
      .createHash("sha512")
      .update(payloadBytes)
      .digest("hex"),
  }).finish();

  const transaction = protobuf.Transaction.create({
    header: transactionHeaderBytes,
    headerSignature: signer.sign(transactionHeaderBytes),
    payload: payloadBytes,
  });
  return transaction;
};

const createBatch = (transactions) => {
  const batchHeaderBytes = protobuf.BatchHeader.encode({
    signerPublicKey: signer.getPublicKey().asHex(),
    transactionIds: transactions.map((txn) => txn.headerSignature),
  }).finish();


  const batch = protobuf.Batch.create({
    header: batchHeaderBytes,
    headerSignature: signer.sign(batchHeaderBytes),
    transactions: transactions,
  });
  return batch;
};




async function sendMsg(msg) {
    try {
      let resp = await fetch("http://localhost:8008/batches", {
        //endpoint to which we write data in a Sawtooth blockchain
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: msg,
      });
      console.log("response--", resp);
    } catch (error) {
      console.log("error in fetch", error);
    }
  }
;

const getCurrentTemp = () => {
  var tempSign = Math.pow(-1,Math.floor(Math.random()*2));
  return Math.floor(Math.random()*tempThresh)*tempSign;
}

const getCurrentLoc = () => {
    var firstPartOfLocationString = getRandom20LenString();
    var secondPartOfLocationString = getRandom20LenString();
    return firstPartOfLocationString + "-" + secondPartOfLocationString;
}

const getCurrTime = () => {
  const hours = (Math.floor(Math.random()*23)).toString(10)
  const minutes = (Math.floor(Math.random()*59)).toString(10)
  return hours + ":" + minutes;
}

const createMsg = (vacId,jsonRequest) => {
  var requestString = JSON.stringify(jsonRequest);
  var requestBatch = createBatch([createTransaction(requestString,vacId)]);
  var batchListBytes = protobuf.BatchList.encode({
    batches: [requestBatch],
  }).finish();

  return batchListBytes;
} 

function sendCreateMsg() {
  var createMessage = createMsg(myVacId,{action:"create",vacId:myVacId,manufacturer:"astra-zeneca",price:0,manufacturingDate:"19.11",manufacturingLoc:"Russia",expiringDate:"8.1"})
  sendMsg(createMessage);
}


function sendTransferMsg() {
  var setTransferMessage = createMsg(myVacId,{action:"transfer",vacId:myVacId});
  sendMsg(setTransferMessage)
}

function sendSample() {
  var currTemp = getCurrentTemp();
  var currLoc = getCurrentLoc();
  var currTime = getCurrTime();
  var sampleMsg = createMsg(myVacId,{action:"update-temp-loc",vacId:myVacId,temp:currTemp,loc:currLoc,time:currTime});
  sendMsg(sampleMsg)
  setTimeout(sendSample,20000)
 }


sendCreateMsg();

setTimeout(sendTransferMsg,5000)

setTimeout(sendSample,5000)



