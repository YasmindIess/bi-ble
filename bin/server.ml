let env_or_default name fallback =
  match Sys.getenv_opt name with
  | Some value when String.trim value <> "" -> value
  | _ -> fallback

let file =
  env_or_default
    "BLOCHFIELD_STREAM_FILE"
    "runtime/local/blochfield.ndjson"

let port =
  match Sys.getenv_opt "PORT" with
  | None -> 8080
  | Some value ->
      begin
        try int_of_string value with
        | Failure _ ->
            failwith ("PORT must be an integer, received: " ^ value)
      end

let read_all path =
  if Sys.file_exists path then
    let ic = open_in path in
    let len = in_channel_length ic in
    let data = really_input_string ic len in
    close_in ic;
    data
  else
    ""

let read_latest path =
  read_all path
  |> String.split_on_char '\n'
  |> List.filter (fun line -> String.trim line <> "")
  |> List.rev
  |> function
     | latest :: _ -> latest
     | [] -> ""

let ndjson_headers =
  [("Content-Type", "application/x-ndjson; charset=utf-8")]

let json_headers =
  [("Content-Type", "application/json; charset=utf-8")]

let stream _request =
  Dream.respond
    ~headers:ndjson_headers
    (read_all file)

let latest _request =
  Dream.respond
    ~headers:json_headers
    (read_latest file)

let health _request =
  Dream.respond
    ~headers:json_headers
    (Printf.sprintf
       {|{"status":"ok","service":"bi-ble-stream","port":%d}|}
       port)

let () =
  Dream.run
    ~interface:"0.0.0.0"
    ~port
  @@ Dream.logger
  @@ Dream.router
       [
         Dream.get "/stream" stream;
         Dream.get "/latest" latest;
         Dream.get "/health" health;
       ]
