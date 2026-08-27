'use strict';

const config = require('../config');

async function submitSettlement(reference, amountCents) {
  return fetch('https://settlement.asteria.example/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.settlementApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reference, amountCents })
  });
}

module.exports = { submitSettlement };

