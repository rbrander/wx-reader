// app.js -- Decode METAR/TAF weather information from a weather API
// API Documentation can be found at https://api.checkwx.com/
// Example: https://www.checkwx.com/weather/CYTZ


const API_KEY = '19b4970bb56b0460a4130b5b67';
const API_URL = 'https://api.checkwx.com/metar/';


// I'm Assuming window.fetch exists!
// TODO: get a polyfill for fetch
// NOTE: I'm using ES8 named regex groups; might need a polyfill

const parseAPIResponse = (response) => {
  if (!response.ok) {
    throw new Error('ERROR: Network response was not ok');
  }

  return response.json()
    .then(responseJSON => {
      /*
      responseJSON looks like this:
      {
        "results": 1,
        "data": [
          "CYTZ 051900Z AUTO 17011KT 9SM CLR 29\/23 A3006 RMK SLP178 DENSITY ALT 1700FT"
        ]
      }
      */
      // Validate meta data
      if (!responseJSON.results || responseJSON.results !== 1) {
        throw new Error(`ERROR: Invalid result: ${responseJSON.results}`);
      }
      // Ensure data exists and it is an array with only one item in it
      if (!responseJSON.data || responseJSON.data.length !== 1) {
        throw new Error(`ERROR: Invalid data: ${JSON.stringify(responseJSON.data)}`)
      }
      return responseJSON.data[0];
    });
};

const getWeather = (airportCode) => {
  const url = API_URL + airportCode;
  const headers = new Headers({
    "Accept": "application/json",
    "X-API-Key": API_KEY
  });
  const options = {
    method: 'GET',
    headers: headers
  };
  return fetch(url, options)
    .then(parseAPIResponse);
};

const parseMETAR = (data) => {
  // NOTE: this function assumes the data is a valid METAR format
  //       and is not designed to validate METAR
  if (typeof data !== 'string') {
    throw new Error('ERROR: Invalid data; must be a string');
  }

  const result = {};
  const splitData = data.split(' ');
  if (splitData.length === 0) {
    throw new Error('ERROR: Invalid data length');
  }

  // Optional 'METAR' phrase at start
  // First thing may be the report type: METAR or SPECI (for special update)
  const reportTypeRegex = /^(?<reportType>METAR|SPECI)$/;
  const hasReportType = splitData.length > 0 && reportTypeRegex.test(splitData[0]);
  if (hasReportType) {
    result.reportType = splitData.shift();
  }

  // Next should be the station ID (ICAO code)
  result.ICAO = splitData.shift();

  /*
    Date/Time of report:

    - The first two numbers are the day of the month followed by the time in Zulu
      (aka Universal or Greenwich Mean Time)

      For example:
        212355Z
      denoes a date/time of:

        21st day of the month at 2355 Zulu

      Note: The report gives no indication of the month or year.
  */
  const time = splitData.shift();
  const timeRegex = /^(?<dayOfMonth>\d{2})(?<hours>\d\d)(?<mins>\d\d)(?<timezone>[Z])$/;
  if (timeRegex.test(time)) {
    result.timestamp = timeRegex.exec(time).groups;
  }

  /*
    Station modifier:
    - If present, it will be either:
        AUTO = automated station
        COR = corrected automated report
  */
  const modifierRegex = /^(?<modifier>AUTO|COR)$/;
  const hasModifier = splitData.length > 0 && modifierRegex.test(splitData[0]);
  if (hasModifier) {
    result.modifier = splitData.shift();
  }

  /*
    Wind direction:
    - The first three numbers are the direction the wind is from (true heading) or "VRB" for variable
    - followed by the speed in knots
    - If the wind is gusting, the highest gust will be displayed after the wind speed
    - Ending the units KT

    For example:
      36007G15KT
    would denote a speed of:
      north at 7 knots with a gust up to 15 knots
  */
  const wind = splitData.shift();
  const windRegex = /^(?<direction>VBR|\d{3})(?<speed>\d\d)(G(?<gustingSpeed>\d\d))?(?<speedUnits>\w\w)$/;
  const hasWind = wind.length > 0 && windRegex.test(wind);
  if (hasWind) {
    result.wind = windRegex.exec(wind).groups;
  }

  /*
    Visibility:
    - The prevailing visibility in statute miles (SM).
    - Fractions are displayed with a space, 1 1/2SM.
    - Additional visibility for a runway may also appear in the report as R (for runway) followed by
      the selected runway, a slash (/), and the visibility in feet for that runway.

    For example:
      R36L/2400FT
    would denote a visibility of:
     2,400 feet (731.5 m) for runway 36 left.
  */

  // First we need to get the distance and units
  // since there could be a space to separate fractional components
  // that means the data we need may be scattered across multiple array elements in splitData

  // We can check the first value for just digits, if it matches, then we know we have a fractional
  // component because we didn't end with any alphabetical letters for units (e.g. SM)

  // Visibility and units: /^(?<visibility>(\d+ )?(\d+(\/\d+)?)+)(?<visibilityUnits>[A-Z]{2})/
  // Runway addition: /( R(?<runway>\d\d([LR]))\/(?<runwayLength>\d+))?)/

  // TODO: refactor this to use a single regex; challenge is to merge together the needed fields
  /*
  const digitsRegex = /^(?<speedWholeNumber>\d+)$/;
  const visibilityRegex = /^(?<visibility>[\d\/]+)(?<visibilityUnits>[A-Z]{2})$/
  const visibility = {};


  const hasOnlyDigits = splitData.length > 0 && digitsRegex.test(splitData[0]);
  if (hasOnlyDigits) {
    Object.assign(visibility, digitsRegex.exec(splitData.shift()).groups);

  }
  result.visibility = visibility;
  */


  return {
    METAR: data,
    parsedMETAR: result
  };
};

const setNodeText = (node, text) => {
  if (!node instanceof HTMLParagraphElement) {
    throw new Error('Invalid node; should be an instance of HTMLParagraphElement');
  }
  // Remove any child nodes if they exist
  if (node.hasChildNodes()) {
    while (node.hasChildNodes()) {
      node.removeChild(node.childNodes[0]);
    }
  }
  node.appendChild(document.createTextNode(text));
}

const displayResult = ({ METAR, parsedMETAR }) => {
  const elMETAR = document.getElementById('METAR');
  setNodeText(elMETAR, METAR);

  const elParsedMETAR = document.getElementById('parsedMETAR');
  setNodeText(elParsedMETAR, JSON.stringify(parsedMETAR, undefined, 2));
};

const getResults = () => {
  getWeather('CYTZ')
    .then(parseMETAR)
    .then(displayResult)
    .catch(console.error);
}

getResults();