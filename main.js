// Authored By:
// Cameron Mathis, Natalie Eichorn, Michelle Williams, Josh Nelson
// February 2020

'use strict';

const AssistantV2 = require('ibm-watson/assistant/v2');
const { IamAuthenticator } = require('ibm-watson/auth');
const alexaVerifier = require('alexa-verifier');

// Using some globals for now
let assistant;
let context;
var session_identifier;
var json;

function errorResponse(reason) {
  return {
    version: '1.0',
    response: {
      shouldEndSession: true,
      outputSpeech: {
        type: 'PlainText',
        text: reason || 'An unexpected error occurred. Please try again later.'
      }
    }
  };
}


function verifyFromAlexa(args, rawBody) {
  return new Promise(function(resolve, reject) {
    const certUrl = args.__ow_headers.signaturecertchainurl;
    const signature = args.__ow_headers.signature;
    alexaVerifier(certUrl, signature, rawBody, function(err) {
      if (err) {
        console.error('err? ' + JSON.stringify(err));
        throw Error('Alexa verification failed.');
      }
      resolve();
    });
  });
}


function createAssistant()
{
	return new Promise(function(resolve, reject)
	{
		console.log("Instantiate the AssistantV2")
		assistant = new AssistantV2(
			{
  				version: '2020-02-05',
  				authenticator: new IamAuthenticator(
				{
    				apikey: 'HUFciyT6Ch2r5myueZYgZPG6Fabjw4Kd1CiJTPiLvm0Y',
  				}),
  				url: 'https://api.us-south.assistant.watson.cloud.ibm.com/instances/5f3ef3b3-0293-47e9-9806-97f8d3e35750',
			});
		resolve()
	});
}

function createSessionID()
{
	return new Promise(function(resolve,reject)
	{
		console.log("Create Session")
		assistant.createSession(
		{
			assistantId: '66f26318-759d-4eae-82bf-0e64534dcc4e'
		})
		.then(res => 
		{
			session_identifier = JSON.stringify(res.result.session_id, null, 2);
			json = res;	
			console.log(session_identifier);
			console.log(JSON.stringify(json, null, 2));
			resolve(json);
		})
		.catch(err => {
			console.log(err);
		});
	});
}

function communicateWithWatson(request, session_json)
{
	return new Promise(function(resolve,reject)
	{
		console.log("Communicate with watson")
		const input = request.intent ? request.intent.slots.everythingslot.value : 'welcome';
    	console.log('Input text: ' + input);
		assistant.message({
			assistantId: '66f26318-759d-4eae-82bf-0e64534dcc4e',
			sessionId: session_json.result.session_id,
			input: 
			{
				text: input
			}
		  },
		  function(err, watsonResponse) {
			if (err) {
			  console.error(err);
			  reject(Error('Error talking to Watson.'));
			} else {
			  console.log('Watson result: ', watsonResponse.result);
			  context = watsonResponse.result.context; // Update global context
			  resolve(watsonResponse);
			}
		  });
	});
}

function terminateSession()
{
	console.log("Terminate Session")
	assistant.deleteSession(
	{
  		assistantId: '66f26318-759d-4eae-82bf-0e64534dcc4e',
  		sessionId: json.result.session_id,
	})
  	.then(res => 
	{
    	console.log(JSON.stringify(res, null, 2));
  	})
  	.catch(err => 
	{
    	console.log(err);
  	});
	return;
}

function sendResponse(response, resolve) {
	console.log('Begin sendResponse');
  
	// Combine the output messages into one message.
	var output;
	if (typeof response.result.output !== 'undefined') {
		output = response.result.output.generic[0].text;
	} else {
		output = response.toString();
	}
	
	console.log('Output text: ' + output);

	// Resolve the main promise now that we have our response
	resolve({
	  version: '1.0',
	  response: {
		shouldEndSession: false,
		outputSpeech: {
		  type: 'PlainText',
		  text: output
		}
	  },
	  sessionAttributes: { watsonContext: context }
	});
  }

function main(args) {
	console.log('Begin action');
	return new Promise(function(resolve, reject)
	{
		if (!args.__ow_body) {
			return reject(errorResponse('Must be called from Alexa.'));
		  }
	  
		  const rawBody = Buffer.from(args.__ow_body, 'base64').toString('ascii');
		  const body = JSON.parse(rawBody);
	  
		  // Alexa attributes hold our context
		  const alexaAttributes = body.session.attributes;
		  console.log('Alexa attributes:');
		  console.log(alexaAttributes);
		  if (typeof alexaAttributes !== 'undefined' && Object.prototype.hasOwnProperty.call(alexaAttributes, 'watsonContext')) {
			context = alexaAttributes.watsonContext;
		  } else {
			context = {};
		  }
	  
		const request = body.request;
		verifyFromAlexa(args, rawBody)
			.then(() => createAssistant())
			.then(() => createSessionID()) 
			.then(() => communicateWithWatson(request, json))
			.then(watsonResponse => sendResponse(watsonResponse, resolve))
			.catch(err =>
			{
				console.log(err);
				reject(errorResponse(err));
			});
	}); 
}

exports.main = main
require('make-runnable');
