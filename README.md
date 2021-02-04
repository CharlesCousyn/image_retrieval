# Image retrieval

**Requirements** <br/>
- [Node.js]
- [NPM]

**How to install the project?** <br/>
Just run ```npm install```

**How to run the project?** <br/>
Just run ```npm start```

**Where do i have to put the file from  [search activity project](https://github.com/CharlesCousyn/search_activities))?** <br/>
In the ``data`` folder

**Where can I change my parameters?** <br/>
In the root folder, in the file ```generalConfig.json```
```
{
  "wantedNumberOfImagesPerActivity": 2500, //Fix the maximum number per activity
  "batchSizeImageDownloading": 10 //How many image are dowloaded in the same batch?
}
```

**Where can I find the results?** <br/>
In the folder ``outputData``. More precisely, in the folders named using activity labels
The images are named using the format ``[activityName]_[id].[extension]``

