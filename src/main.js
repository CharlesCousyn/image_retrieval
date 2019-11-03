import filesSystem from 'fs'
import { from } from 'rxjs'
import axios from "axios"
import uuidv4 from "uuid/v4"
import { filter, map, concatMap, mergeAll, toArray, take, bufferCount} from 'rxjs/operators'

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
			response.data.pipe(writer);

			return new Promise((resolve, reject) =>
			{
				writer.on('finish', () =>
				{
					writer.close();
					resolve("success");
				});

				writer.on('error', () =>
				{
					writer.close();
					reject(`Error during writing image steam with url ${url}`);
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
	const nameDir = `./outputData/${activityResult.activityName.replace(" ", "_")}`;

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

async function run ()
{
	let filePath = `./data/${filesSystem.readdirSync('./data', { encoding: 'utf8' })}`;
	let arrayOfActivityResults = JSON.parse(filesSystem.readFileSync(filePath));

	from(arrayOfActivityResults)
	.pipe(map(createActivityFolder))
	.pipe(concatMap(activity =>
		from(activity.results)
		.pipe(map(x => x.urlImage))
		.pipe(filter(x => isPicture.test(x)))
		.pipe(take(GENERAL_CONFIG.wantedNumberOfImagesPerActivity))
		.pipe(bufferCount(GENERAL_CONFIG.batchSizeImageDownloading))
		.pipe(concatMap(someUrls =>
			from(someUrls)
			.pipe(map(url =>
			{
				let arraySplit = url.split("?").shift().split(".");
				let pathToImage = `${activity.nameDir}/${uuidv4()}.${arraySplit[arraySplit.length - 1]}`;
				return from(download_image(url, pathToImage).catch(err => err));
			}))
		))
	))
	.pipe(mergeAll())
	.pipe(filter(res => res !== "success"))
	.pipe(toArray())
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