import filesSystem from 'fs'
import fsExtra from 'fs-extra'

async function removeFolder(folder) {
	try {
		await fsExtra.remove(`./outputData/${folder}`)
		//done
	} catch (err) {
		console.error(err)
	}
}

function reset()
{
	filesSystem.readdir("outputData",
		(err, files) =>
		{
			if (err) throw err;
			console.log(files);
			Promise.all(files.map(removeFolder)).then(() => {console.log("Reset Complete")});
		});
}

reset();
