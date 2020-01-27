import filesSystem from 'fs'
import { from } from 'rxjs'
import axios from "axios"
import uuidv4 from "uuid/v4"
import { filter, map, concatMap, mergeAll, mergeMap, toArray, take, bufferCount, tap} from 'rxjs/operators'
import * as base64url from 'base64-url'

import GENERAL_CONFIG from "../generalConfig"

const isPicture = /^.*\.(jpg|png|gif|bmp|jpeg)/i;
const isContentTypeImage = /image\/.*[^\s]/i;

async function download_image (url, image_path)
{
	try
	{
		const response = await axios({url, responseType: 'stream'});

		let isContentTypeImageBool = isContentTypeImage.test(response.headers["content-type"]);
		if(isContentTypeImageBool)
		{
			const writer = filesSystem.createWriteStream(image_path);

			return new Promise((resolve, reject) =>
			{
				response.data
					.pipe(writer)
					.on('finish', () =>
					{
						writer.close();
						resolve("success");
					})
					.on('error', () =>
					{
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
	const nameDir = `./outputData/${activityResult.name.replace(" ", "_")}`;

	if (!filesSystem.existsSync(nameDir))
	{
		filesSystem.mkdirSync(nameDir);
	}

	activityResult["nameDir"] = nameDir;

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

	from(arrayOfActivityResults)//Stream activity results
	.pipe(map(createActivityFolder))//Stream activity results
	.pipe(concatMap(activity =>
		from(activity.results)//Stream results
		.pipe(map(x => x.urlImage))//Stream urls
		.pipe(filter(x => isPicture.test(x)))//Stream urls
		.pipe(take(GENERAL_CONFIG.wantedNumberOfImagesPerActivity))//Stream urls
		.pipe(bufferCount(GENERAL_CONFIG.batchSizeImageDownloading))//Stream de arrays de urls
		.pipe(concatMap(someUrls =>
			from(someUrls)//Stream urls
			.pipe(mergeMap(url =>
			{
				let arraySplit = url.split("?").shift().split(".");
				let imageName = base64url.encode(url);
				let pathToImage = `${activity.nameDir}/${imageName}.${arraySplit[arraySplit.length - 1]}`;
				return from(download_image(url, pathToImage).catch(err => err));
			}))//Stream de string ("success" ou)
			.pipe(tap(() =>
			{
				currentNumberOfResults++;
				showProgress(currentNumberOfResults, totalNumberOfResults, initTime);
			}))
		))//Stream de string ("success" ou)
	))//Stream de string ("success" ou)
	.pipe(filter(res => res !== "success"))//Stream de  string ("success" ou)
	.pipe(toArray())//Stream de array de string ("success" ou)
	.pipe(map(errors =>
	{
		console.error("Errors: ", errors);
		writeJSONFile(errors, null, "./outputData/errors.json");
	}))
	.subscribe(() =>
	{
		console.log("Done");
	});
}

run().then();
