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

// function makeVacId() {
//   var result           = '';
//   var characters       = '0123456789';
//   var charactersLength = characters.length;
//   for ( var i = 0; i < 20; i++ ) {
//      result += characters.charAt(Math.floor(Math.random() * charactersLength));
//   }
//   return result;
// }

// const myVacId = makeVacId();

// const createTransaction = (payload,vacID) => {
//   console.log("hell of a transaction")
//   const encoder = new TextEncoder("utf8");
//   const payloadBytes = encoder.encode(payload);
//   const transactionHeaderBytes = protobuf.TransactionHeader.encode({
//     familyName: FAMILY,
//     familyVersion: "1.0",
//     inputs: [getVacAddress(vacID)],
//     outputs: [getVacAddress(vacID)],
//     signerPublicKey: signer.getPublicKey().asHex(),
//     batcherPublicKey: signer.getPublicKey().asHex(),
//     dependencies: [],
//     nonce: "" + Math.random(),
//     payload_encoding: "utf8",
//     payloadSha512: crypto
//       .createHash("sha512")
//       .update(payloadBytes)
//       .digest("hex"),
//   }).finish();

const createTransaction = (payload,vacId) => {
  // const [gameName, action, space] = payload.split(",");
  const encoder = new TextEncoder("utf8");
  const payloadBytes = encoder.encode(payload);
  const transactionHeaderBytes = protobuf.TransactionHeader.encode({
    familyName: FAMILY,
    familyVersion: "1.0",
    inputs: [getVacAddress(vacId)],
    outputs: [getVacAddress(vacId)],
    signerPublicKey: signer.getPublicKey().asHex(),
    // In this example, we're signing the batch with the same private key,
    // but the batch can be signed by another party, in which case, the
    // public key will need to be associated with that key.
    batcherPublicKey: signer.getPublicKey().asHex(),
    // In this example, there are no dependencies.  This list should include
    // an previous transaction header signatures that must be applied for
    // this transaction to successfully commit.
    // For example,
    // dependencies: ['540a6803971d1880ec73a96cb97815a95d374cbad5d865925e5aa0432fcf1931539afe10310c122c5eaae15df61236079abbf4f258889359c4d175516934484a'],
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
//   if (batchListBytes == null) {
//     try {
//       var geturl = "http://localhost:8008/state/" + this.address; //endpoint used to retrieve data from an address in Sawtooth blockchain
//       console.log("Getting from: " + geturl);
//       let response = await fetch(geturl, {
//         method: "GET",
//       });
//       let responseJson = await response.json();
//       var data = responseJson.data;
//       var newdata = Buffer.from(data, "base64").toString();
//       return newdata;
//     } catch (error) {
//       console.error(error);
//     }
  //} else {
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

const createMsg = (vacId,jsonRequest) => {
  var requestString = JSON.stringify(jsonRequest);
  var requestBatch = createBatch([createTransaction(requestString,vacId)]);
  var batchListBytes = protobuf.BatchList.encode({
    batches: [requestBatch],
  }).finish();

  return batchListBytes;
} 

function sendCreateMsg() {
  var createMessage = createMsg("1213123123",{action:"create",vacId:"1213123123",manufacturer:"astra-zeneca",price:0,manufacturingDate:"19.11",manufacturingLoc:"Russia",expiringDate:"8.1"})
  sendMsg(createMessage);
}


// function sendTransferMsg() {
//   var setTransferMessage = createMsg(myVacId,{action:"transfer",vacId:myVacId});
//   sendMsg(setTransferMessage)
// }

// function sendSample() {
//   var sampleMsg = createMsg(myVacId,{action:"update-temp-loc",vacId:myVacId,temp:"14",loc:"1213123123",time:"123123"});
//   sendMsg(sampleMsg)
//   setTimeout(sendSample,10000)
//  }


sendCreateMsg();

// setTimeout(sendTransferMsg,5000)

// setTimeout(sendSample,5000)



