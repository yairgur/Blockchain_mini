'use strict'

const { createHash } = require('crypto')
const { TransactionHandler } = require('sawtooth-sdk/processor/handler')
const { InvalidTransaction } = require('sawtooth-sdk/processor/exceptions')
const { TransactionHeader } = require('sawtooth-sdk/protobuf')
const { TextEncoder, TextDecoder } = require("text-encoding/lib/encoding");
const decoder = new TextDecoder("utf8");
const timeout = 300

// helper function to generate addresses based on sha512 hash function 
const getAddress = (key, length = 64) => {
        
        return createHash('sha512').update(key).digest('hex').slice(0, length)
    }

// helper function to get the address of a vaccine in the vaccine namespace
const getAssetAddress = name => PREFIX + getAddress(name, 58)

// gets the address of the main properties
const getMainPropsAddress = (vacId) => {
    return getAssetAddress(vacId) + '00' + '0000' // zeros split for clarity
}

// gets the address if the temp array
const getTempArrayAddress = (assetName, index) => {
    return getAssetAddress(assetName) + '01' + index
}

// function to add leading zero(s) to nextIndex
const padIndex = (index) => {
    let paddedIndex = index + "";
    while (paddedIndex.length < 4)
        paddedIndex = "0" + paddedIndex
    return paddedIndex
}


// transaction family is defined by a name
const FAMILY = 'vaccine'
    // address namespace is 3 bytes, created as first 6 hex characters of hash of family name
const PREFIX = getAddress(FAMILY, 6)

// helper functions to encode and decode binary data
const encode = obj => Buffer.from(JSON.stringify(obj, Object.keys(obj).sort()))
const decode = buf => JSON.parse(buf.toString())


const verifyJsonFields = (jsonPayload,fields) => {
    fields.forEach(jsonField => {
        if (!jsonPayload.hasOwnProperty(jsonField))
            throw new InvalidTransaction(jsonField + " field in json is missing")
    })
}



const createVac = (payload,state,signer) => {
    verifyJsonFields(payload,["vacId","manufacturer","price","manufacturingDate","manufacturingLoc","expiringDate"])
  
    const mainPropsAddress = getMainPropsAddress(payload.vacId)
    console.error(mainPropsAddress)

    return state.getState([mainPropsAddress],timeout)
        .then(entries => {
            // check if an asset already exists on the address
            const entry = entries[mainPropsAddress] // there is only one entry because only one address was queried

            if (entry && entry.length > 0) {
                throw new InvalidTransaction('vacId is already in use')
            }
            // new asset is added to the state
            return state.setState({
                [mainPropsAddress]: encode({
                    vacId: payload.vacId,
                    signer,
                    manufacturer: payload.manufacturer,
                    price: payload.price,
                    manufacturingDate: payload.manufacturingDate,
                    manufacturingLoc: payload.manufacturingLoc,
                    expiredDate: payload.expiredDate,
                    isInTransfer: false,
                    samples: [],
                    ruined: false,
                    nextIndex: 1
                }, )
            },timeout)
        })
}



const setTransfer = (payload,state,signer) => {
    
    verifyJsonFields(payload,["vacId"])
    const mainPropsAddress = getMainPropsAddress(payload.vacId)

    return state.getState([mainPropsAddress],timeout)
        .then(entries => {
            
            const entry = entries[mainPropsAddress] 
            if (!(entry && entry.length > 0)) {
                throw new InvalidTransaction('vaccine not found')
            }

            let vacState = decode(entry)

            vacState.isInTransfer = true

            return state.setState({
                [mainPropsAddress]: encode(vacState)
            },timeout)
        })
}


const addTempAndLoc = (payload,state,signer) => {

        verifyJsonFields(payload,["vacId","temp","loc","time"])

        const mainPropsAddress = getMainPropsAddress(payload.vacId)

        return state.getState([mainPropsAddress])
            .then(entries => {
                
                const entry = entries[mainPropsAddress] 
                if (!(entry && entry.length > 0)) {
                    throw new InvalidTransaction('vaccine not found')
                }

                let vacState = decode(entry)

                vacState.samples.push(JSON.stringify({ location: payload.loc, temp: payload.temp, time: payload.time }))
                    
                vacState.nextIndex += 1
                    
                // check if temp exceeds spoiled threshold
                if (payload.temp > -70 || payload.temp < -200) {
                    vacState.ruined = true
                    console.log("vaccine is ruined by temperature")
                }
                //new temp is added to state and asset main properties saved
                return state.setState({
                    [mainPropsAddress]: encode(vacState)
                },timeout)
            })
    }
    


const supportedActionsList = ["create","transfer","update-temp-loc"];

const parsePayloadFromTransaction = (payloadBytes) => {
    
    const decodedPayload = decoder.decode(payloadBytes)
    console.error(decodedPayload)
    const payload = JSON.parse(decodedPayload)
   
    if (!payload.hasOwnProperty('action')) //not working
        throw new InvalidTransaction("Action is required");
    
    if (!supportedActionsList.includes(payload.action))
        throw new InvalidTransaction("Action is not supported");

    return payload;
}



class VacHandler extends TransactionHandler {
    constructor() {
        console.log('VacHandler init.')
        super(FAMILY, ["1.0"], [PREFIX]) 
    }

    apply(vacTranx, state) { 
        const header = vacTranx.header;
        const signer = header.signerPubkey;
        
        const payload = parsePayloadFromTransaction(vacTranx.payload)

        
        if (payload.action === 'create') 
            return createVac(payload,state,signer)
        
        if (payload.action === 'transfer') 
            return setTransfer(payload,state,signer)
        
        if (payload.action === 'update-temp-loc') 
            return addTempAndLoc(payload,state,signer)
        

        console.error('no handler function was found for the action')

        return Promise.resolve().then(() => {
            throw new InvalidTransaction(
                'Action must be "create, transfer, or update-temp-loc"' // list to be expanded when more actions are created
            )
        })
    }
}

module.exports = {
    VacHandler
}

