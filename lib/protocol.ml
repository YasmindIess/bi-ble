type role = Central | Peripheral
type energy = { joules : int }

type idle
type advertising
type scanning
type connecting
type connected
type secured

type _ phase =
  | Idle : idle phase
  | Advertising : advertising phase
  | Scanning : scanning phase
  | Connecting : connecting phase
  | Connected : connected phase
  | Secured : secured phase

type 'p state = {
  role : role;
  energy : energy;
  phase : 'p phase;
}

type evt =
  | Adv | Scan | Connect | Establish | Pair
  | Read | Write | Notify | Disconnect

type (_, _) trans =
  | T_adv : (idle, advertising) trans
  | T_scan : (idle, scanning) trans
  | T_connect : (advertising, connecting) trans
  | T_establish : (scanning, connected) trans
  | T_pair : (connecting, secured) trans
  | T_read : (connected, connected) trans
  | T_write : (connected, connected) trans
  | T_notify : (secured, secured) trans
  | T_disconnect : ('a, idle) trans

type ex_state = State : 'p state -> ex_state

let string_of_role = function
  | Central -> "Central"
  | Peripheral -> "Peripheral"

let string_of_phase : type p. p phase -> string = function
  | Idle -> "Idle"
  | Advertising -> "Advertising"
  | Scanning -> "Scanning"
  | Connecting -> "Connecting"
  | Connected -> "Connected"
  | Secured -> "Secured"

let string_of_evt = function
  | Adv -> "Adv" | Scan -> "Scan" | Connect -> "Connect"
  | Establish -> "Establish" | Pair -> "Pair"
  | Read -> "Read" | Write -> "Write"
  | Notify -> "Notify" | Disconnect -> "Disconnect"

let show_state : type p. p state -> string =
 fun s ->
  Printf.sprintf "{role=%s; phase=%s; joules=%d}"
    (string_of_role s.role)
    (string_of_phase s.phase)
    s.energy.joules

let cost _ = 1

let step : type p q. p state -> (p, q) trans -> q state option =
 fun s t ->
  if s.energy.joules <= 0 then None else
  let energy = { joules = s.energy.joules - cost t } in
  let role = s.role in
  match t with
  | T_adv -> Some { role; energy; phase = Advertising }
  | T_scan -> Some { role; energy; phase = Scanning }
  | T_connect -> Some { role; energy; phase = Connecting }
  | T_establish -> Some { role; energy; phase = Connected }
  | T_pair -> Some { role; energy; phase = Secured }
  | T_read -> Some { role; energy; phase = Connected }
  | T_write -> Some { role; energy; phase = Connected }
  | T_notify -> Some { role; energy; phase = Secured }
  | T_disconnect -> Some { role; energy; phase = Idle }

type (_, _) path =
  | Done : ('p, 'p) path
  | Step : ('p, 'q) trans * ('q, 'r) path -> ('p, 'r) path

let rec run :
  type p q. p state -> (ex_state -> unit) -> (p, q) path -> q state option =
 fun s hook path ->
  hook (State s);
  match path with
  | Done -> Some s
  | Step (t, rest) ->
      match step s t with
      | None -> None
      | Some s' -> run s' hook rest

let mk_idle role j =
  { role; energy = { joules = j }; phase = Idle }
