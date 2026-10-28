import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const file=fileURLToPath(new URL('../ui/src/features/connections/ConnectionSetupFlow.tsx',import.meta.url));
const source=readFileSync(file,'utf8');

test('Bostan names its own generic MCP connection and OAuth experience',()=>{
  for(const phrase of [
    'Let Bostan check',
    'Bostan asks the server what it needs',
    'Bostan sends your key as an Authorization header.',
    'Values are stored as Bostan secrets',
    'What should Bostan be able to do?',
    'Use Bostan instead',
    'Bostan callback URL',
    "Register Bostan's callback URI",
    'Bostan is creating a secure',
    'Bostan validates the connector',
    'Bostan has a guided setup',
    'Bostan couldn’t check the retained connection.',
    'Bostan couldn’t start secure sign-in.',
    'Bostan cannot increase its permissions.',
  ])assert.ok(source.includes(phrase),`Missing Bostan first-party copy: ${phrase}`);
});

test('retains real external GitHub app/Cloud enrollment labels rather than misrepresenting ownership',()=>{
  // External integrations remain their actual upstream services until
  // credentials, endpoints and supported apps are reimplemented/rebranded.
  const expected=[
    'Install Paperclip and grant at least one repository',
    'This instance is connected to Paperclip, but',
    'Connect with Paperclip',
    'You must connect this instance to Paperclip',
    'Paperclip couldn’t check Cloud registration.',
    'Connect with Paperclip',
    'Install Paperclip on GitHub',
  ];
  const actual=source.split('\n').filter(line=>line.includes('Paperclip')).map(line=>line.trim());
  assert.equal(actual.length,expected.length,'Unexpected legacy brand in first-party connection screen');
  for(const phrase of expected){
    const found=actual.findIndex(line=>line.includes(phrase));
    assert.ok(found>=0,`Unexpected upstream integration change: ${phrase}`);
    actual.splice(found,1);
  }
  assert.equal(actual.length,0);
});

test('OAuth and connector flows remain wired to existing names, not altered protocol identifiers',()=>{
  assert.match(source,/oauthCallbackErrorMessage/);
  assert.match(source,/callbackUrl/);
  assert.match(source,/connectorEnrollmentQuery/);
  assert.match(source,/startConnectorEnrollment\.mutate\(\)/);
  assert.match(source,/githubRecoveryUrl/);
});
