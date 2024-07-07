'use strict';

var AWS = require('aws-sdk');

const REGION = 'us-east-1';
AWS.config.update({ region: REGION });

const dynamo = new AWS.DynamoDB.DocumentClient();

const getSearchCoin = async (event, context) => {
    const params = {
        TableName: 'SearchedPrice'
    };

    const scanResults = [];
    let items;
    do {
        items = await dynamo.scan(params).promise();
        items.Items.forEach((item) => scanResults.push(item));
        params.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (typeof items.LastEvaluatedKey != "undefined");
    console.log('scanResults', JSON.stringify(scanResults));
    return { 
        'statusCode': 200,
        'headers': {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            coins: scanResults
        })
      };
};

exports.getSearchCoin = getSearchCoin;
