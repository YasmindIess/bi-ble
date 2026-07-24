open Protocol

let file =
  Sys.getenv_opt "BLOCHFIELD_STREAM_FILE"
  |> Option.value ~default:"runtime/local/blochfield.ndjson"

let append s =
  let oc = open_out_gen [Open_creat; Open_append] 0o644 file in
  output_string oc (s ^ "\n");
  close_out oc

let escape s =
  String.concat "\\\"" (String.split_on_char '"' s)

let hash s = Digest.to_hex (Digest.string s)

let encrypt s =
  "enc(" ^ s ^ ")"

type phase_tag =
  | PIdle
  | PAdvertising
  | PScanning
  | PConnecting
  | PConnected
  | PSecured

let phase_tag_of : type p. p phase -> phase_tag = function
  | Idle -> PIdle
  | Advertising -> PAdvertising
  | Scanning -> PScanning
  | Connecting -> PConnecting
  | Connected -> PConnected
  | Secured -> PSecured

let last_phase : phase_tag option ref = ref None

let emit (State s) =
  let current = phase_tag_of s.phase in

  begin match !last_phase, current with
  | Some PSecured, PIdle ->
      let receipt =
        Printf.sprintf
          {|{"from":"Secured","to":"Idle","role":"%s","joules":%d}|}
          (string_of_role s.role)
          s.energy.joules
      in
      let commitment = hash receipt in
      let ciphertext = encrypt receipt in
      let proof = hash (receipt ^ "|valid_transition") in
      append
        (Printf.sprintf
           {|{"ciphertext":"%s","commitment":"%s","proof":"%s"}|}
           (escape ciphertext) commitment proof)
  | _ -> ()
  end;

  last_phase := Some current
