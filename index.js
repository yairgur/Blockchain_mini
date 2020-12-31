'use strict'

const { TransactionProcessor } = require('sawtooth-sdk/processor')
const { VacHandler } = require('./myHandlers')
    /*
    const DEFAULT_VALIDATOR_URL = 'tcp://localhost:4004'
    let validatorUrl;

    if (process.argv.length < 3) {
      console.log('No validator url passed as argument, defaulting to: ' + DEFAULT_VALIDATOR_URL)
      validatorUrl = DEFAULT_VALIDATOR_URL
    }
    else { validatorUrl = process.argv[2] }
    */
const DEFAULT_VALIDATOR_URL = 'tcp://localhost:4004'
validatorUrl = DEFAULT_VALIDATOR_URL
const tp = new TransactionProcessor(validatorUrl)
tp.addHandler(new VacHandler())
tp.start()