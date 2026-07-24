open Protocol

let () =
  let s = mk_idle Peripheral 10 in

  let path =
    Step (T_adv,
    Step (T_connect,
    Step (T_pair,
    Step (T_disconnect,
    Done))))
  in

  match run s Blochfield_bridge.emit path with
  | None -> print_endline "Failed"
  | Some s ->
      print_endline ("Final: " ^ show_state s)
