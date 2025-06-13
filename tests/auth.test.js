const fs = require('fs');

test('firebase config has correct projectId', () => {
  const content = fs.readFileSync('auth.js', 'utf8');
  expect(content).toMatch(/projectId:\s*"da-box-59"/);
});
