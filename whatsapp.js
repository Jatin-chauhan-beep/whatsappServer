const mongoose = require("mongoose");
const multer = require("multer");
let express = require("express");
const grid = require("gridfs-stream");
const { GridFsStorage } = require("multer-gridfs-storage");
let app = express();
app.use(express.json());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE, HEAD"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

const Connection = async () => {
  const URL = `mongodb://user:user123@ac-ohw39xz-shard-00-00.wdd6fdn.mongodb.net:27017,ac-ohw39xz-shard-00-01.wdd6fdn.mongodb.net:27017,ac-ohw39xz-shard-00-02.wdd6fdn.mongodb.net:27017/?ssl=true&replicaSet=atlas-hu4yhk-shard-0&authSource=admin&retryWrites=true&w=majority`;
  try {
    await mongoose.connect(URL, { useUnifiedTopology: true });
    console.log("connect to mongodb successfully");
  } catch (error) {
    console.log("not Connected");
  }
};
Connection();
const port = process.env.PORT || 2410;
app.listen(port, () => console.log(`Listening on port ${port}!`));

//const User = require("./user.js");
//const conversation = require("./conversation.js");
//const message = require("./messages.js");

const userSchema = mongoose.Schema({
  name: { type: String },
  email: { type: String },
  about: { type: String },
  image: { type: String },
});

const User = mongoose.model("users", userSchema);

const ConversationSchema = mongoose.Schema(
  {
    members: { type: Array },
    message: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const conversation = mongoose.model("conversation", ConversationSchema);

const MessageSchema = mongoose.Schema(
  {
    senderid: { type: String },
    receiverid: { type: String },
    conversationid: { type: String },
    type: { type: String },
    text: { type: String },
  },
  {
    timestamps: true,
  }
);

const message = mongoose.model("message", MessageSchema);

const storage = new GridFsStorage({
  url: `mongodb://user:user123@ac-ohw39xz-shard-00-00.wdd6fdn.mongodb.net:27017,ac-ohw39xz-shard-00-01.wdd6fdn.mongodb.net:27017,ac-ohw39xz-shard-00-02.wdd6fdn.mongodb.net:27017/?ssl=true&replicaSet=atlas-hu4yhk-shard-0&authSource=admin&retryWrites=true&w=majority`,
  options: { useNewUrlParser: true },
  file: (request, file) => {
    const match = ["image/png", "image/jpg"];

    if (match.indexOf(file.mimetype) === -1)
      return `${Date.now()}-blog-${file.originalname}`;

    return {
      bucketName: "photos",
      filename: `${Date.now()}-blog-${file.originalname}`,
    };
  },
});

const upload = multer({ storage });

let gfs, gridFsBucket;
const conn = mongoose.connection;
conn.once("open", () => {
  console.log("MongoDB connection opened successfully");
  gridFsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "fs",
  });
  gfs = grid(conn.db, mongoose.mongo);
  gfs.collection("fs");
});

const url = "http://localhost:2410";
app.post("/login", async (req, res) => {
  try {
    let user = await User.findOne({ email: req.body.email });

    if (user) {
      res.send(user);
    } else {
      res.status(404).send("User not found");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

app.get("/users", async (req, res) => {
  try {
    let user = await User.find({});
    if (user) {
      res.send(user);
    } else res.status(404).send("user do not exist");
  } catch (err) {
    res.status(500).send(err);
  }
});
app.get("/user/:id", async (req, res) => {
  try {
    let id = req.params.id;
    let user = await User.findOne({ _id: id });
    if (user) {
      res.send(user);
    } else res.status(404).send("user do not exist");
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post("/conversation/add", async (req, res) => {
  try {
    let { senderid, receiverid } = req.body;
    const exist = await conversation.findOne({
      members: { $all: [senderid, receiverid] },
    });
    if (exist) {
      res.send("conersation exists");
    } else {
      const newConversation = new conversation({
        members: [senderid, receiverid],
      });
      await newConversation.save();
      res.send("convresation saved");
    }
  } catch (err) {
    res.status(500).send("Internal server error");
  }
});

app.post("/conversation/get", async (req, res) => {
  try {
    let { senderid, receiverid } = req.body;
    let conv = await conversation.findOne({
      members: { $all: [senderid, receiverid] },
    });
    res.send(conv);
  } catch (err) {
    res.status(500).send("Internal server error");
  }
});
app.post("/message/add", async (req, res) => {
  try {
    const newMessage = new message({
      senderid: req.body.senderid,
      receiverid: req.body.receiverid,
      conversationid: req.body.conversationid,
      type: req.body.type,
      text: req.body.text,
    });
    await newMessage.save();
    await conversation.findByIdAndUpdate(req.body.conversationid, {
      message: req.body.text,
    });
    res.send("message sent successfully");
  } catch (err) {
    res.status(500).send("Internal server error");
  }
});

app.get("/messages/:id", async (req, res) => {
  try {
    let mssgs = await message.find({ conversationid: req.params.id });
    res.send(mssgs);
  } catch (err) {
    res.status(500).send("Internal server error");
  }
});

app.post("/file/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) response.status(404).json("File not found");

    const imageUrl = `${url}/file/${req.file.filename}`;

    res.send(imageUrl);
  } catch (err) {
    res.status(500).send("Internal server error");
  }
});

app.get("/file/:filename", async (req, res) => {
  try {
    const file = await gfs.files.findOne({ filename: req.params.filename });

    if (!file) {
      return res.status(404).send({ msg: "File not found" });
    }

    const readStream = gridFsBucket.openDownloadStream(file._id);
    readStream.pipe(res);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send({ msg: "Internal server error" });
  }
});
