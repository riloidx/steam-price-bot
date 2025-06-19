const axios = require('axios');

let currencies = {};

async function getBankData() {
    const response = await axios.get(
        'https://developerhub.alfabank.by:8273/partner/1.0.1/public/nationalRates'
    );

    const result = {};
    response.data.rates.forEach(rate => {
        result[rate.iso] = {
            rate: rate.rate,
            quantity: rate.quantity
        };
    });
    return result;
}

function convertToByn(price, currency) {
    const rateInfo = currencies[currency];
    const pricePerUnit = rateInfo.rate / rateInfo.quantity;
    return price * pricePerUnit;
}

async function convertPricesToByn(price) {
    console.log(price);
    if (Object.keys(currencies).length === 0) {
        currencies = await getBankData();
        console.log(currencies);
    }

    const priceInByn = convertToByn(price.final, price.currency).toFixed(2);
    return {
        ...price,
        converted: {
            currency: 'BYN',
            final: priceInByn,
            formatted: `${priceInByn} Br`,
        }
    };
}

module.exports = {
    convertPricesToByn
};