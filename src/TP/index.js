
'use strict'

const { TransactionProcessor } = require('sawtooth-sdk/processor')
const { VacHandler } = require('./myHandlers')


let validatorUrl = 'tcp://localhost:4004'
const tp = new TransactionProcessor(validatorUrl)
tp.addHandler(new VacHandler())
tp.start()
