const crypto = require('crypto');

function getDiscriminator(programName, instructionName) {
  const message = `${programName}:${instructionName}`;
  const hash = crypto.createHash('sha256').update(message).digest();
  return hash.slice(0, 8);
}
const disc = getDiscriminator("nova", "buy");
console.log("Calculated discriminator:", disc);
