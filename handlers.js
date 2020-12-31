'use strict'

const { createHash } = require('crypto')
const { TransactionHandler } = require('sawtooth-sdk/processor')
const { InvalidTransaction } = require('sawtooth-sdk/processor/exceptions')
const { TransactionHeader } = require('sawtooth-sdk/protobuf')

// helper function to generate addresses based on sha512 hash function 
const getAddress = (key, length = 64) => {
        return createHash('sha512').update(key).digest('hex').slice(0, length)
    }
    // helper function to get the address of an asset in the fish namespace
const getAssetAddress = name => PREFIX + getAddress(name, 58)

// gets the address of the main properties
const getMainPropsAddress = (assetName) => {
    return getAssetAddress(assetName) + '00' + '0000' // zeros split for clarity
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

// handler for action 'create'
// add a new asset to the state
const createAsset = (vacId, signer, state, manufacturer, price, manufacturingDate, manufacturingLoc, expiredDate) => {
    const mainPropsAddress = getMainPropsAddress(asset)

    return state.get([mainPropsAddress])
        .then(entries => {
            // check if an asset already exists on the address
            const entry = entries[mainPropsAddress] // there is only one entry because only one address was queried
            if (entry && entry.length > 0) {
                throw new InvalidTransaction('vacId is already in use')
            }

            // new asset is added to the state
            return state.set({
                [mainPropsAddress]: encode({
                    name: vacId,
                    signer,
                    manufacturer: manufacturer,
                    price: price,
                    manufacturingDate: manufacturingDate,
                    manufacturingLoc: manufacturingLoc,
                    expiredDate: expiredDate,
                    isInTransfer: false,
                    samples: [],
                    ruined: false,
                    nextIndex: 1
                }, )
            })
        })
}

// handler for action 'add-tilted'
const setTransfer = (vacId, signer, state) => {
    const mainPropsAddress = getMainPropsAddress(vacId)

    return state.get([mainPropsAddress])
        .then(entries => {
            // check if an asset exists on the address
            const entry = entries[mainPropsAddress] // there is only one entry because only one address was queried
            if (!(entry && entry.length > 0)) {
                throw new InvalidTransaction('vacId not found')
            }

            let vacState = decode(entry)

            // assign new values
            vacState.isInTransfer = true


            // set tilted to true and return the new state
            return state.set({
                [mainPropsAddress]: encode(vacState)
            })
        })
}

// handler for action 'add-temp'
const setTempAndLoc = (vacId, signer, state, temp, time, currentLoc) => {
        const mainPropsAddress = getMainPropsAddress(vacId)

        return state.get([mainPropsAddress])
            .then(entries => {
                // check if an asset exists on the address
                const entry = entries[mainPropsAddress] // there is only one entry because only one address was queried
                if (!(entry && entry.length > 0)) {
                    throw new InvalidTransaction('Asset not found')
                }

                let vacState = decode(entry)

                const tempAndLocAddress = getLocAndTempArray(vacId, padIndex(vacState.nextIndex))

                vacState.nextIndex += 1

                // check if temp exceeds spoiled threshold
                if (temp > -70 || temp < -200) {
                    vacState.ruined = true
                    console.log("vaccine is ruined by temperature")
                }
                //new temp is added to state and asset main properties saved
                return state.set({
                    [tempAndLocAddress]: encode({ location: loc, temp: temp, time: time }),
                    [mainPropsAddress]: encode(vacState)
                })
            })
    }
    /*
    const transferVac = (vacId, signer, state) => {
        const mainPropsAddress = getMainPropsAddress(vacId)

        return state.get([mainPropsAddress])
            .then(entries => {
                // check if an asset exists on the address
                const entry = entries[mainPropsAddress] // there is only one entry because only one address was queried
                if (!(entry && entry.length > 0)) {
                    throw new InvalidTransaction('Asset not found')
                }

                let vacState = decode(entry)
    /*
                //check if spoiled
                if (!processed.spoiled) {
                    // change owner and sold staus
                    processed.owner = signer
                    processed.sold = true
                } else {
                    console.log(processed.name + 'is spoiled. No transfer possible.')
                }
                // save changes in state
                return state.set({
                    [mainPropsAddress]: encode(processed)
                })
            })
    }*/

class VacHandler extends TransactionHandler {
    constructor() {
        console.log('VacHandler init.')
        super(FAMILY, '0.0', 'application/json', [PREFIX]) // 0.0 = version of family
    }

    // this function is called by the transaction processor when new transaction needs to be handled
    apply(vacTranx, vacState) { /*possible to save max temp*/
        // parse the transaction header and payload
        const header = TransactionHeader.decode(vacTranx.header)
        const signer = header.signerPubkey
        const { action, vacId /*asset*/ , manufacturer /*owner*/ , price /*sold*/ , manufacturingDate /*catchTime*/ , manufacturingLoc /*catchLat*/ , expiredDate /*catchLon*/ , temp, currentLoc /*time*/ , time } = JSON.parse(vacTranx.payload)

        // call the appropriate function based on the payload's action
        console.log(`Handling transaction:  ${action} > ${vacId}`,
            manufacturer ? `> ${manufacturer.slice(0, 8)}... ` : '',
            `:: ${signer.slice(0, 8)}...`)

        // depending on the type, the correct handler is called
        if (action === 'create') return createVac(vacId, signer, state, manufacturer, price, manufacturingDate, manufacturingLoc, expiredDate)
            /*if (action === 'add-tilted') return setTilted(asset, signer, state)
            if (action === 'add-temp') return setTemp(asset, signer, state, temp, time)*/
        if (action === 'transfer') return transferVac(vacId, signer, state)
        if (action === 'update-temp-loc') return setTempAndLoc(vacId, signer, state, temp, time, currentLoc)

        // no handler function was found for the action
        return Promise.resolve().then(() => {
            throw new InvalidTransaction(
                'Action must be "create, add-tilted, add-temp or transfer"' // list to be expanded when more actions are created
            )
        })
    }
}

module.exports = {
    VacHandler
}

/*
addTempAndloc => 1. is the item in transfer mode?
                 2. if yes => then add to the state [time,temp,loc] (we will hold an array for each vac of the samples sent)
                 3. if not => reject transaction 
            
transfer => change the "isInTransfer" field in state of the vac to true , if there is no vacid in the system with the given id then reject it

create => create if there's no vac in the system with the same vac id given */