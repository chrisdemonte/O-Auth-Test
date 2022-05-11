//https://aniapi.com/docs/
//token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc3MCIsIm5iZiI6MTYzODI4NDAxNiwiZXhwIjoxNjQwODc2MDE2LCJpYXQiOjE2MzgyODQwMTZ9.D2NcPex717-WMFA-W7GEB8G2xqpN2BLnLHE4J5mtmBw
//Id 89c743ff-cb8d-4d83-bcb9-7d94d767c64d
//home ID bdd94da6-606d-427b-b38f-2f44101880e2
//Redirect URI: http://localhost:3000
//secret: 88a65983-1b3d-4429-a528-b50992cd733a
//home secret: edcb2ceb-47a6-440d-affa-da6f67b1033f
//youtube apikey: AIzaSyBwk-1je3zGIZ0_3Mo_ZOknbGZHLaKnuOQ
const fs = require("fs");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const querystring = require("querystring");

const anime_id = 'bdd94da6-606d-427b-b38f-2f44101880e2';
const anime_secret = 'edcb2ceb-47a6-440d-affa-da6f67b1033f';
const youtube_key = 'AIzaSyBwk-1je3zGIZ0_3Mo_ZOknbGZHLaKnuOQ';
var anime_token = '';
var top_anime_list = [];
var res_ref = '';
var youtube_comments = [];
var youtube_counter = 0;
const redirect_url = 'http://localhost:3000/home';
const port = 3000;

const server = http.createServer();
server.on("request", request_handler);
server.on("listening", listen_handler);
server.listen(port);
const states = [];

function request_handler(req, res){
    console.log(`New Request from ${req.socket.remoteAddress} for ${req.url}`);
    res_ref = res;
    if (req.url === "/"){
        const form = fs.createReadStream("index.html");
        res.writeHead(200, "OK", {'Content-Type': 'text/html'});
        form.pipe(res);
    }
    else if (req.url.startsWith("/login")){
        const user_input = new URL(req.url, `http://${req.headers.host}`).searchParams;
        const user_login = user_input.get('loginName');
        if (user_login == null || user_login == ""){
            res.writeHead(404, {"Content-Type":"text/html"});
            res.end("<h1>404: Username Invalid</h1>");
        }
        else {
            const state = crypto.randomBytes(20).toString("hex");
            states.push({user_login, state});
            const auth_endpoint = `https://api.aniapi.com/v1/oauth?response_type=code&client_id=${anime_id}&redirect_uri=${redirect_url}&state=${state}`;
            res.writeHead(302, {Location: auth_endpoint}).end();            
        }
    }
    else if (req.url.startsWith("/home")){
        
        const anime_params_1 = new URL(req.url, `http://${req.headers.host}`).searchParams;
        const code = anime_params_1.get('code');
        const username = states[0].user_login.toString().toUpperCase();   
        let options = {method: "POST"};
        https.request(`https://api.aniapi.com/v1/oauth/token?client_id=${anime_id}&client_secret=${anime_secret}&code=${code}&redirect_uri=${redirect_url}`, options, process_token).end();
        res.writeHead(200, "OK", {'Content-Type': 'text/html'});
        res.write(`<div><h1>Anime Look-up</h1><div>
        <div><h2>WELCOME ${username}!</h2></div>`);
    }
    else {
        res.writeHead(404, {"Content-Type":"text/html"});
        res.end("<h1>404: Page Not Found</h1>");
    }
}
function listen_handler(){
    console.log(`Server Open: Listening on Port ${port}`);
}
function process_token(stream){
    let body = "";
    stream.on("data", chunk=> body += chunk);
    stream.on("end", () => {
        console.log(body);
        const token_obj = JSON.parse(body);
        anime_token = token_obj.data;
        console.log(anime_token);
        anime_information_api_call();
    });
}
function anime_information_api_call(){
    let options = {method: "GET"};
    https.request(`https://api.aniapi.com/v1/anime?formats=0,1&status=0,1&genres=Action&nsfw=true`, options, process_anime_list).end();
}
function process_anime_list(stream){
    let body = "";
    stream.on("data", chunk=> body += chunk);
    stream.on("end", () => {
        const anime_obj = JSON.parse(body);
        top_anime_list = anime_obj.data.documents;
        youtube_counter = 0;
        get_youtube_comments();
    });
}

function get_youtube_comments(){
    
    if (youtube_counter >= 25){
        populate_homepage();
        return;
    }
    else if (top_anime_list[youtube_counter].trailer_url != undefined){
        video_code = top_anime_list[youtube_counter].trailer_url.toString().split("embed/")[1];
        let options = {method: "GET"};
        https.request(`https://youtube.googleapis.com/youtube/v3/commentThreads?part=snippet&maxResults=5&videoId=${video_code}&key=${youtube_key}`, options, add_to_comments).end();
    }
    else {
        youtube_counter++
        youtube_comments.push("");
        get_youtube_comments();
    }
}
function add_to_comments(stream){
    let body = "";
    stream.on("data", chunk=> body += chunk);
    stream.on("end", () => {
        youtube_comments.push(body.slice(body.indexOf("\"textDisplay")).split(",")[1]);
        youtube_counter++;
        get_youtube_comments();
    });
}
function populate_homepage(){
    res_ref.write(`<div><h1>TOP 25 Action Anime: </h1></div>`);
    for (let i = 0; i < 25; i++){
        res_ref.write(`<h2> ${i + 1}) ${top_anime_list[i].titles.en}</h2>`);
        res_ref.write(`<div><p> Year: ${top_anime_list[i].season_year}      Episodes: ${top_anime_list[i].episodes_count}      Score: ${top_anime_list[i].score}</p></div>`);
        res_ref.write(`<div><img id="img-${i}" src = "` + top_anime_list[i].banner_image + `" width = "750"></img></div>`);
        if (top_anime_list[i].trailer_url != undefined){
            res_ref.write(`<div><iframe id="ytplayer" type="text/html" width="750" height="400" src=" ${top_anime_list[i].trailer_url}?autoplay=0" frameborder="0"></iframe></div>`);
           res_ref.write(`<div><h3>COMMENTS:</h3></div><div><p>${youtube_comments[i]}</p></div>`);
         }
    }
    res_ref.end();
}
