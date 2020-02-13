import filesSystem from 'fs'
import { from, partition} from 'rxjs'
import axios from "axios"
import uuidv4 from "uuid/v4"
import { filter, map, concatMap, mergeAll, mergeMap, toArray, take, bufferCount, tap} from 'rxjs/operators'
import * as base64url from 'base64-url'
import * as mime from "mime-types"

import GENERAL_CONFIG from "../generalConfig"

const isPicture = /^.*\.(jpg|png|gif|bmp|jpeg)/i;
const isContentTypeImage = /image\/.*[^\s]/i;

const httpClient = axios.create();
httpClient.defaults.timeout = 60 * 1000;

async function download_image (url, image_path_without_extension)
{
	try
	{
		const response = await httpClient({url, responseType: 'stream', timeout: 60 * 1000});

		const contentType = response.headers["content-type"];
		const extension = mime.extension(contentType);

		if(isContentTypeImage.test(contentType))
		{
			const writer = filesSystem.createWriteStream(`${image_path_without_extension}.${extension}`);

			return new Promise((resolve, reject) =>
			{
				response.data
					.pipe(writer)
					.on('finish', () =>
					{
						writer.close();
						resolve("success");
					})
					.on('error', (e) =>
					{
						console.log(`Error during writing image stream with url ${url}`, e);
						writer.close();
						reject(`Error during writing image stream with url ${url}`);
					});
			});

		}
		else
		{
			return Promise.reject(`Content at '${url}' is not an image! The content type was '${response.headers["content-type"]}'`);
		}
	}
	catch(e)
	{
		return Promise.reject(`Error while doing a request to url ${url}: ${e}`);
	}
}

function createActivityFolder(activityResult)
{
	//Transform name with _ character
	let find = ' ';
	let re = new RegExp(find, 'g');

	const nameDir = `./outputData/${activityResult.name.replace(re, "_")}`;

	if (!filesSystem.existsSync(nameDir))
	{
		filesSystem.mkdirSync(nameDir);
	}

	activityResult["nameDir"] = nameDir;
	activityResult["nameImageBeginning"] = activityResult.name.replace(re, "_");

	return activityResult;
}

function writeJSONFile(data, replacer, path)
{
	filesSystem.writeFileSync(path, JSON.stringify(data, replacer, 4), "utf8");
}

function timeConversion(ms)
{
	let seconds = (ms / 1000).toFixed(1);
	let minutes = (ms / (1000 * 60)).toFixed(1);
	let hours = (ms / (1000 * 60 * 60)).toFixed(1);
	let days = (ms / (1000 * 60 * 60 * 24)).toFixed(1);

	if (seconds < 60) {
		return seconds + " Sec";
	} else if (minutes < 60) {
		return minutes + " Min";
	} else if (hours < 24) {
		return hours + " Hrs";
	} else {
		return days + " Days"
	}
}

function showProgress(currentNumberOfResults, totalNumberOfResults, beginTime)
{
	const timeElapsed = timeConversion(new Date() - beginTime);
	console.log(`Progress ${currentNumberOfResults}/${totalNumberOfResults} (${100.0 * currentNumberOfResults/totalNumberOfResults} %) (${timeElapsed} elapsed)`);
}

async function run ()
{
	let filePath = `./data/${filesSystem.readdirSync('./data', { encoding: 'utf8' })}`;
	let arrayOfActivityResults = JSON.parse(filesSystem.readFileSync(filePath));

	//Progress variables
	let totalNumberOfResults = arrayOfActivityResults.map(activity => activity.realNumberResults).reduce((tot, curr) => tot + curr, 0);
	let currentNumberOfResults = 0;
	let initTime = new Date();
	showProgress(currentNumberOfResults, totalNumberOfResults, initTime);

	const all = await from(arrayOfActivityResults)//Stream activity results
		.pipe(map(createActivityFolder))//Stream activity results
		.pipe(concatMap(activity =>
			from(activity.results)//Stream results
				.pipe(map((x, index) => [x.urlImage, index]))//Stream urls
				.pipe(filter(([urlImage, index]) => isPicture.test(urlImage)))//Stream urls
				.pipe(take(GENERAL_CONFIG.wantedNumberOfImagesPerActivity))//Stream urls
				.pipe(bufferCount(GENERAL_CONFIG.batchSizeImageDownloading))//Stream de arrays de urls
				.pipe(concatMap(someUrlsAndIndex =>
				{
					return from(someUrlsAndIndex)//Stream urls
						.pipe(mergeMap(([urlImage, index]) =>
						{
							return from(download_image(urlImage, `${activity.nameDir}/${activity.nameImageBeginning}_${index}`).catch(err => err));
						}))//Stream de string ("success" ou)
						.pipe(tap(() =>
						{
							currentNumberOfResults++;
							showProgress(currentNumberOfResults, totalNumberOfResults, initTime);
						}))
				}
				))//Stream de string ("success" ou)
		))
		.toPromise();//Stream de string ("success" ou);

	const [errors, valids] = partition(from(all), res => res !== "success");

	const errorStream = errors
		.pipe(toArray())
		.pipe(map(errors =>
		{
			console.error("Errors: ", errors);
			writeJSONFile(errors, null, "./outputData/errors.json");
		}));

	await Promise.all([errorStream.toPromise(), valids.toPromise()]);
}

(async () =>
{
	await run();
})();
