const fs = require('fs');
const assert = require('assert');

const content = fs.readFileSync('auth.js', 'utf8');
assert(/projectId:\s*"da-box-59"/.test(content), 'Firebase config should have correct projectId');
console.log('All tests passed');
