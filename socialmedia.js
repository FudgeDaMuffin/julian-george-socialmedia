const fs = require('fs')
const express = require('express')
const mongo = require('mongodb')
const app = express()
const MongoClient = mongo.MongoClient
const url= "mongodb://localhost:27017/"
//default databases and collections to be used, changing up here changes all down below
const dbToUse="userdata"
const collectionToUse="users"
/**
*given a path to a JSON file and a database name, add all entries in the 
*JSON data's list to the desired database
*/
const populateDB = async(path,mydb,collection)=>{
    //first reads the json file with given path
    //uses a promise to do the database insertion after the file reading without callbacks
    let fileRead= new Promise((resolve)=>{
        fs.readFile(path,(err,data)=>{
            if (err) throw err
            //resolves with the parsed JSON
            resolve(JSON.parse(data))
        })
    })
    //the parsed JSON is then passed here, where we connect to mongoDB and insert it
    fileRead.then(async(result)=>{
        MongoClient.connect(url,async(err,db)=>{
           if (err) throw err
           const dbo=db.db(mydb)
           //for loop loops through each user in the JSON, adding a unique ID, and then adding them to the list
           for (let i = 0;i<result.length;i++){
               IDGenerator(mydb,collection).then((ID)=>{
                   console.log("ID"+ID)
                   result[i].id=ID
                   dbo.collection(collection).insertOne(result[i],(err,resp)=>{
                       if (err) throw err
                       //when the last user in the JSON has been added, display that all entries have at least started to be inserted
                       //note that there's still a possibility that not all users have been fully inserted yet, if earlier users have more data and take longer to insert
                       if (i==result.length-1){
                           console.log("Finished inserting entries")
                       }
                   })
               })
           }
        }) 
    })
    
}
/**
* returns a unique, random 8-character alphanumberic ID to be assigned to a user
*/
const IDGenerator= async(mydb,collection)=>{
    return new Promise(resolve =>{
        const possibleChars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
        let ID=""
        for (let i = 0;i<8;i++){
            ID+=possibleChars.charAt(Math.round(Math.random()*possibleChars.length))
        }
        //connects to db to check if ID already is assigned
        MongoClient.connect(url,(err,db)=>{
            if (err) throw err
            const dbo = db.db(mydb)
            dbo.collection(collection).findOne({"id":ID},(err,result)=>{
                if (err) throw err
                db.close()
                //if there are no users with current ID, this ID is good to return
                if (result==null) resolve(ID)
                //if there are users with this ID, call IDGenerator again to attempt to get a new ID
                else resolve(IDGenerator(db,collection))
            })
        })
    })
}
/**
* returns the full database entry of the user with the specified id
*/
const getAllData =async(id,mydb,collection)=>{
    return new Promise(resolve=>{
        MongoClient.connect(url,(err,db)=>{
            if (err) throw err
            const dbo=db.db(mydb)
            dbo.collection(collection).findOne({"id":id},(err,result)=>{
                if (err) throw err
                db.close()
                if (result==null) resolve({type:"error",reason:"No entries with ID "+id+" found"})
                else resolve(result)
            })
        })
    })  
}
/**
* returns basic, essential data to be used in some cases
* the essential data here is the user's name, their year, their profile picture, 
* their gender, and their home
*/
const getBasicData =async(id,mydb,collection)=>{
    return new Promise(resolve=>{
        MongoClient.connect(url,(err,db)=>{
            if (err) throw err
            const dbo = db.db(mydb)
            dbo.collection(collection).findOne({"id":id},(err,result)=>{
                db.close()
                if (result==null) resolve({type:"error",reason:"No entries with ID "+id+" found"})
                let newObj ={
                    name:result.name,
                    year:result.year,
                    picture:result.picture,
                    gender:result.gender,
                    home:result.home
                }
                resolve(newObj)
            })
        })
    })
}
/**
* returns user's specific data based on a given characteristic (field)
* besides fields in database, you can also ask for ethnicity and degree to get
* full info in those two fields
*/
const getSpecificData=async(id,field,mydb,collection)=>{
    return new Promise(resolve=>{
        if (field==null||field==""||field==undefined) resolve({type:"error",reason:"Invalid field provided"})
        MongoClient.connect(url,(err,db)=>{
            if (err) throw err
            const dbo = db.db(mydb)
            dbo.collection(collection).findOne({"id":id},(err,result)=>{
                db.close()
                if (result==null) resolve({type:"error",reason:"No entries with ID "+id+" found"})
                else if (field=="ethnicity") {
                    //asking for ethnicity returns an array of the user's ethnicities
                    let ethnicityFields=["American Indian or Alaska Native","Asian","Black or African American","Hispanic or Latino","Middle Eastern","Native Hawaiian or Other Pacific Islander","White"]
                    let ethnicity=[]
                    ethnicityFields.forEach((race)=>{
                        let raceResult=result[race]
                        if (raceResult!=""){
                            ethnicity.push(raceResult)
                        }
                    })
                    resolve(ethnicity)
                }
                else if (field=="degree") {
                    //asking for the degree returns an object with a user's major, minor, and modification if they exist
                    let degreeFields=["major","minor","modification"]
                    let degreeObj={}
                    for (let i=0;i<degreeFields;i++){
                        if (result[degreeFields[i]]!=""){
                            degreeObj[degreeFields[i]]=result[degreeFields[i]]
                        }
                    }
                    resolve(degreeObj)
                }
                else {
                    //else, return the requested property from the entry in the database, if it has that property
                    if (!result.hasOwnProperty(field)) resolve({type:"error",reason:"Entry does not have field "+field})
                    else resolve(result[field])
                }
            })
        })
        
    })
}
/**
* returns an array with the users who have the matching value (value) of a given property/characteristic (field)
*/
const getUsersByField = async(field,value, mydb,collection)=>{
    return new Promise(resolve =>{
        if (field==null||field==""||field==undefined) resolve({type:"error",reason:"Invalid field provided"})
        MongoClient.connect(url,(err,db)=>{
            if (err) throw err
            const dbo=db.db(mydb)
            let finder = {}
            //sets the finder (object used to search db) so that it will return where the field is the desired value
            finder[field]=value
            let sorter = {}
            //sets the sorter (object used to sort results) so it will sort results in descending order
            sorter[field]=-1
            dbo.collection(collection).find(finder).sort(sorter).toArray((err,result)=>{
                if (err) throw err
                db.close()
                resolve(result)
            })
        })
    })
}
/**
* returns object where each value of the given characteristic (field) is assigned a frequency and a percentage 
* for how common it is in the database
*/
const getFrequency = async(field,mydb,collection)=>{
    return new Promise(resolve =>{
        if (field==null||field==""||field==undefined) resolve({type:"error",reason:"Invalid field provided"})
        MongoClient.connect(url,(err,db)=>{
            if (err) throw err
            const dbo = db.db(mydb)
            let finder = {}
            //sets finder so that the query will only return objects which have the desired field
            finder[field]={$exists:true}
            dbo.collection(collection).find(finder).toArray((err,result)=>{
                if (result.lenth==0) resolve({type:"error",reason:"No entries have field "+field})
                else {
                    //removing all fields from the results besides the one we want
                    result=result.map((ele)=>{return ele[field]})
                    //creates a map of the fields and their frequencies using frequencyFinder()
                    let freqMap = frequencyFinder(result)
                    //conversion of Map to Object from GitHub user lukehorvat: https://gist.github.com/lukehorvat/133e2293ba6ae96a35ba
                    let freqObj = Array.from(freqMap).reduce((freqObj,[key,value])=>(
                        Object.assign(freqObj, {[key]:value})
                    ),{})
                    resolve(freqObj)
                }
            })
            
        })
    })
}
/**
* given an array of values (values), returns a map with the values as the keys and their numerical and percentage frequency as the value
*/
const frequencyFinder=(values)=>{
    let frequencies= new Map()
    values.forEach((value)=>{
        //if this value is already in the map, increment its frequency, if not, add and set to 1
        if (frequencies.has(value)) frequencies.set(value,frequencies.get(value)+1)
        else frequencies.set(value,1)
    })
    let iter= frequencies.keys()
    //iterates through the map, replacing the value with an object containing frequency and percentage
    while (true){
        let next = iter.next()
        if (next.done==true) break;
        else {
            let val= frequencies.get(next.value)
            //percentage goes to first decimal
            let percentage=Math.round((val/values.length)*1000)/10+"%"
            frequencies.set(next.value,{frequency:val,percentage:percentage})
        }
    }
    return frequencies
}
/**
* adds a user to the database, given a user object (user)
*/
const addUser = async(user,mydb,collection)=>{
    return new Promise(resolve =>{
        if (user=={}||user==null||user==undefined) resolve({type:"error",reason:"Invalid user data"})
        MongoClient.connect(url,(err,db)=>{
            if (err) throw err
            const dbo=db.db(mydb)
            IDGenerator(mydb,collection).then(id=>{
                user.id=id
                dbo.collection(collection).insertOne(user,(err,result)=>{
                    db.close()
                    if (err) {
                        throw err
                        resolve({type:"error",reason:err.err})
                    }
                    else resolve({type:"success",reason:""})
                }) 
            })
           
        })
    })
}
/**
* edits a characteristic (field) of a user (given by id), changing its value to a new one (value)
*/
const editUser = async(id,field,value,mydb,collection)=>{
    return new Promise(resolve =>{
        if (field==null||field==""||field==undefined) resolve({type:"error",reason:"Invalid field provided"})
        if (value==null||value==""||value==undefined) resolve({type:"error",reason:"Invalid value provided"})
        if (id==null||id==undefined||id==""||id.length!=8) resolve({type:"error",reason:"Invalid ID provided"})
        MongoClient.connect(url,(err,db)=>{
            if (err) throw err
            const dbo=db.db(mydb)
            let updater = {}
            updater[field]=value
            dbo.collection(collection).updateOne({"id":id},{$set:updater},(err,result)=>{
                db.close()
                if (err) {
                    throw err
                    resolve({type:"error",reason:err.err})
                }
                else resolve({type:"success",reason:""})
            })
        })
    })
}
/**
* removes a user (given by id) from database
*/
const deleteUser = async(id,mydb,collection)=>{
    return new Promise(resolve=>{
        if (id==null||id==undefined|id==""||id.length!=8) resolve({type:"error",reason:"Invalid ID provided"})
        MongoClient.connect(url,(err,db)=>{
            if (err) throw err
            const dbo=db.db(mydb)
            dbo.collection(collection).deleteOne({"id":id},(err,result)=>{
                if (err) {
                    throw err
                    resolve({type:"error",reason:err.err})
                }
                else {
                    resolve({type:"success",reason:""})
                }
            })
        })
    })
}
app.get('/',(req,res)=>{
    let requestType= req.query.requestType
    let userID= req.query.id
    let response;
    //responds to request with object type "error" if the userID isnt the right format
    if (userID==null||userID==undefined||userID==""||userID.length!=8) res.end({type:"error",reason:"Invalid ID provided"})
    //if not, it assigns response to a Promise, and when the promise resolves it sends a response with its result
    else {
        if (requestType == "allData") response=getAllData(userID,dbToUse,collectionToUse)
        else if (requestType == "basicData") response=getBasicData(userID,dbToUse,collectionToUse)
        else if (requestType == "specificData") response=getSpecificData(userID,req.query.field,dbToUse,collectionToUse)
        else if (requestType == "usersByField") response=getUsersByField(req.query.field,req.query.value,dbToUse,collectionToUse)
        else if (requestType == "frequency") response=getFrequency(req.query.field,dbToUse,collectionToUse)
        response.then(userObj=>{
            if (userObj.hasOwnProperty("type")&&userObj.type=="error"){
                res.end(JSON.stringify(userObj))
            }
            else {
                //successful responses have type "success" and the data is stored in its data property
                let successObj = {type:"success",reason:"",data:{}}
                delete userObj.id
                successObj.data=userObj
                res.end(JSON.stringify(successObj))
            }     
        })   
    } 
})
app.post('/',(req,res)=>{
    let requestType=req.query.requestType
    let response;
    if (requestType=="addUser") response=addUser(req.query.userdata,dbToUse,collectionToUse)
    else if (requestType=="editUser") response=editUser(req.query.id,req.query.field,req.query.value,dbToUse,collectionToUse)
    else if (requestType=="deleteUser") response=deleteUser(req.query.id,dbToUse,collectionToUse)
    response.then((obj)=>{
        res.end(JSON.stringify(obj))
    })
    
})
app.listen(3000, () =>
  console.log('Social media app listening on port 3000'),
);
try{
    //populateDB("DALI_Data.json",dbToUse,collectionToUse)
}
catch(err) {
    console.log("Error while executing: "+err)
}