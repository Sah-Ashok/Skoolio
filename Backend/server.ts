import app from "./src/app"
import dotenv from 'dotenv'
import './src/workers/feeBilling.worker'

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT , ()=>{
    console.log(`Server is running on port ${PORT}`)
})