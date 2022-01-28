const fs = require("fs")
const xml2js = require("xml2js")

const EXPORT_CONFIG = {
  'subdomains': (data) => {
    return [['subdomains', data.flatMap(s => s.subdomain)]]
  },
  'cookies': (data) => {
    return data.flatMap(s => s.cookie).map(cookie => {
      const {name, host} = cookie['$']
      const val = cookie["_"]
      const key = `cookie:${name}:${host}`
      return [key, val]
    })
  }
}

/**
 * Takes an object and extracts data from it according to an `exportConfig`.
 * @returns Returns a list of key value pairs (lists) {string, any}[][]
 */
function extractData(data, exportConfig = EXPORT_CONFIG) {
  let keys = Object.keys(exportConfig)
  let out = []

  for(let i = 0; i < keys.length; i++) {
    let method = exportConfig[keys[i]]
    let object = data['config'][keys[i]]

    if(object == undefined) continue; // Skip the entry
    out.push(method(object))
  }

  // Returns a list of key value pairs (lists)
  return out
}

// Handle exporting to REDIS
async function exportToRedis(data, db, exportConfig = EXPORT_CONFIG) {
  let keyValList = extractData(data, exportConfig).flat()
  for(let i = 0; i < keyValList.length; i++) {
    const keyValPair = keyValList[i];
    await db.set(keyValPair[0], keyValPair[1]) // Save the data into the database
  }
}

// Main method
async function main(file, flag_verbose, db) {
  const parser = new xml2js.Parser()
  const file_data = await fs.promises.readFile(file, "utf8")
  let parsed = await parser.parseStringPromise(file_data)
  await exportToRedis(parsed, db)

  if(flag_verbose) {
    console.log(await db.get("*"))
  }
  db.close()
}

// Handle arguments if it is not a 
if(require.main == module) {
  const {DB_Prod} = require("./database")
  const db = new DB_Prod() // Connect to REDIS

  let flag_verbose = false;
  let fileName = ""

  for(let i = 2; i < process.argv.length; i++) {
    if(process.argv[i] == '-v') flag_verbose = true;
    else if(fileName == "") fileName = process.argv[i]
  }
  if(fileName == "") throw "The file name is empty"
  main(fileName, flag_verbose, db)
}

module.exports = {
  main,
  extractData,
  exportToRedis,
  EXPORT_CONFIG
}