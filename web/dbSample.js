import mongoose from "mongoose"; 

const MONGODB_URI = "mongodb://127.0.0.1:27017/tapita_sample"; 

const connectDatabase = async () => { 
    mongoose.Promise = global.Promise; 
    try { 
        mongoose.set("strictQuery", true); 
        await mongoose.connect(MONGODB_URI); 
        console.log("Connected to MongoDB"); 
        const isLogged = true; 
        if (isLogged) { 
            mongoose.set("debug", true); 
        } 
    } catch (error) { 
        console.error("Error connecting to MongoDB:", error); 
    } 
}; 

export { connectDatabase };