const readline = require('readline');
const { createHash } = require('crypto')
const fetch = require("node-fetch");
const { exit } = require('process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

// helper function to generate addresses based on sha512 hash function 
function getAddress(key, length = 64) {
    return createHash('sha512').update(key).digest('hex').slice(0, length)
}

const FAMILY = "vaccine";
const PREFIX = getAddress(FAMILY, 6)


// helper function to get the address of a vaccine in the vaccine namespace
function getAssetAddress(name) { return (PREFIX + getAddress(name, 58)) }

// gets the address of the main properties
function getMainPropsAddress(vacId) {
return getAssetAddress(vacId) + '00' + '0000' // zeros split for clarity
}




async function getVaccineState(address) {
    try {
        var geturl = "http://localhost:8008/state/" + address; //endpoint used to retrieve data from an address in Sawtooth blockchain
        console.log("Getting from: " + geturl);
        let response = await fetch(geturl, {
            method: "GET",
        });
        let responseJson = await response.json();
        var data = responseJson.data;
        var newdata = Buffer.from(data, "base64").toString();
        console.log(newdata)
        exit(0)
        } catch (error) {
              console.error(error);
        }
}
 

    // rl.question('What is your id? ', (answer) => {
    var vacId = "11123123123123"//answer
    console.log(vacId)
    var vacAddressInState = getMainPropsAddress(vacId);
    console.log(vacAddressInState)
    let response = getVaccineState(vacAddressInState)
    // })



var asd = "11123123123123";