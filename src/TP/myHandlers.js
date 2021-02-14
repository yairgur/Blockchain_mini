'use strict'

const { createHash } = require('crypto')
const { TransactionHandler } = require('sawtooth-sdk/processor/handler')
const { InvalidTransaction } = require('sawtooth-sdk/processor/exceptions')
const { TransactionHeader } = require('sawtooth-sdk/protobuf')
const { TextEncoder, TextDecoder } = require("text-encoding/lib/encoding");
const decoder = new TextDecoder("utf8");
const timeout = 300



const getAddress = (key, length = 64) => createHash('sha512').update(key).digest('hex').slice(0, length);


const getVaccineAddress = name => ADDRESS_PREFIX + getAddress(name, 58);

const getCompleteVaccineAddress = (vacId) => getVaccineAddress(vacId) + '00' + '0000'; // zeros split for clarity

const FAMILY = 'vaccine'

const ADDRESS_PREFIX = getAddress(FAMILY, 6)

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
  
    const vacStateAddress = getCompleteVaccineAddress(payload.vacId)
    
    console.log(vacStateAddress)

    return state.getState([vacStateAddress],timeout).then(entries => {
        const entry = entries[vacStateAddress] 

        if (entry && entry.length > 0) {
            throw new InvalidTransaction('vacId is already in use')
        }
            
        return state.setState({[vacStateAddress]: encode({
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
    const vacStateAddress = getCompleteVaccineAddress(payload.vacId)

    return state.getState([vacStateAddress],timeout).then(entries => {
            
        const entry = entries[vacStateAddress] 
        
        if (!(entry && entry.length > 0)) {
            throw new InvalidTransaction('vaccine not found')
        }

        let vacState = decode(entry)

        vacState.isInTransfer = true

        return state.setState({[vacStateAddress]: encode(vacState)},timeout)
    })
}


const addTempAndLoc = (payload,state,signer) => {

    verifyJsonFields(payload,["vacId","temp","loc","time"])

    const vacStateAddress = getCompleteVaccineAddress(payload.vacId)

    return state.getState([vacStateAddress]).then(entries => {
                
        const entry = entries[vacStateAddress]

        if (!(entry && entry.length > 0)) {
            throw new InvalidTransaction('vaccine not found')
        }

        let vacState = decode(entry)

        vacState.samples.push(JSON.stringify({ location: payload.loc, temp: payload.temp, time: payload.time }))
                    
        vacState.nextIndex += 1
                    
        if (payload.temp > -70 || payload.temp < -200) {
            vacState.ruined = true
            console.log("vaccine is ruined by temperature")
        }

        return state.setState({[vacStateAddress]: encode(vacState)},timeout)
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
        super(FAMILY, ["1.0"], [ADDRESS_PREFIX]) 
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

