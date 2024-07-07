'use strict';

var AWS = require('aws-sdk');
var fetch = require('node-fetch');
var clientSes = require('@aws-sdk/client-ses');
var moment = require('moment');
var uuid = require('uuid');

// Set the AWS Region.
const REGION = "us-east-1";
// Create SES service object.
AWS.config.update({ region: REGION });
const sesClient = new clientSes.SESClient();
const ssm = new AWS.SSM();
const dynamo = new AWS.DynamoDB.DocumentClient();

const createSendEmailCommand = (toAddress, coinName, currentPrice) => {
  return new clientSes.SendEmailCommand({
    Destination: {
      /* required */
      CcAddresses: [],
      ToAddresses: [ toAddress ],
    },
    Message: {
      /* required */
      Body: {
        /* required */
        Html: {
          Charset: "UTF-8",
          Data: `AUD: ${currentPrice}`,
        },
        Text: {
          Charset: "UTF-8",
          Data: "This is the message body in text format.",
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `Current Price of ${coinName}`,
      },
    },
    Source: "walidjamarin21@gmail.com",
    ReplyToAddresses: [
      /* more items */
    ],
    ReturnPath: "walidjamarin21@gmail.com"
  });
};

const errorResponse = (errorMessage) => {
  return  {
    'statusCode': 400,
    'headers': {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      error: errorMessage
    })
  };
};

const successResponse = (successMessage) => {
  return { 
    'statusCode': 200,
    'headers': {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        message: successMessage
    })
  };
};

const sendEmail = async (recipientEmail, coinName, currentPrice) => {
  const sendEmailCommand = createSendEmailCommand(
    recipientEmail,
    coinName,
    currentPrice,
  );

  try {
    return await sesClient.send(sendEmailCommand);
  } catch (caught) {
    if (caught instanceof Error && caught.name === "MessageRejected") {
      /** @type { import('@aws-sdk/client-ses').MessageRejected} */
      const messageRejectedError = caught;
      throw messageRejectedError;
    }
    throw caught;
  }
};

const putItem = async (name) => {
  const results = await dynamo
      .put({
          TableName: 'SearchedPrice',
          Item: {
            dateCreated: moment().format('DD-MM-YYYY HH:MM:ss'),
            name: name ,
            id: uuid.v4() 
          },
      })
      .promise();

  console.log(JSON.stringify(results));
};

const getCurrentPrice = async (event, context) => {
    console.log('Received event:', JSON.stringify(event));
    const apiKeyParameterStoreName = 'DemoApiKey';
    const { Parameter } = await ssm.getParameter({Name: apiKeyParameterStoreName, WithDecryption: false }).promise();
    const apiKey = Parameter.Value;
    console.log(`apiKey: ${apiKey}`);
    const coinName = event['queryStringParameters']['name'].toLowerCase();
    const email = event['queryStringParameters']['email'];
    console.log(`parameters: ${coinName}, ${email}`);
    if(!coinName || !email) {
      return errorResponse('Incomplete request parameter');
    }
    // Default to AUD for now.
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinName}&vs_currencies=aud`;
    const options =  {
      method: 'get', 
      headers: {
          'x-cg-demo-api-key': apiKey, 
          'Content-Type': 'application/json'
      }
  };
    const geckoResponse = await fetch(url, options);
    const data = await geckoResponse.json();
    const currentPrice = data[coinName]?.aud;
    console.log('currentPrice', currentPrice);
    if(!currentPrice) {
      return errorResponse('Price not found');
    }
    
    const dynamoResponse = await putItem(coinName);
    console.log('dynamoResponse', JSON.stringify(dynamoResponse));
    
    const emailResponse = await sendEmail(email, coinName, currentPrice);
    console.log('emailResponse', JSON.stringify(emailResponse));
    
    return successResponse('Email sent successfully');
};

exports.getCurrentPrice = getCurrentPrice;
