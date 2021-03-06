const formatterRegex = /(\{(\d+)\})+/gm;


/**
 * Enforces two-digits on a number by prepending '0' where needed
 * @param {Number|String} number The number to pad
 * @returns {String} The padded number
 */
function forceTwoDigits (number) {
  return number.toString().padStart(2, '0');
}


/**
 * Formats the string with drop-in args
 * @param {String} content The string to format
 * @param {...Object} args The args to format the string with
 */
function formatString (content, ...args) {
  let match;
  while (null !== (match = formatterRegex.exec(content))) {
    content = content.replace(match[0], args[Number(match[2])]);
  }
  return content;
}


/**
 * Logs a message to console
 * @param {String} loglevel The severity of the message
 * @param {String} message The message to log
 * @param {Array<*>} args Any additional arguments
 */
function log (loglevel, message, ...args) {
  const date = new Date();
  const hour = forceTwoDigits(date.getHours());
  const min = forceTwoDigits(date.getMinutes());
  const sec = forceTwoDigits(date.getSeconds());

  console.log(`[${hour}:${min}:${sec}] [${loglevel.padEnd(5)}] ${formatString(message, ...args)}`); // eslint-disable-line
}

for (const method of ['DEBUG', 'INFO', 'WARN', 'ERROR']) {
  module.exports[method.toLowerCase()] = log.bind(null, method);
}
