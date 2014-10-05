// Private helpers

var _new_thread = function(program_name) {
    return {
        program_name: program_name,
        ip: 0,
        runnable: true
        
    };
};

var _new_semaphore = function(name, initial_count) {
    return {
        name: name,
        count: initial_count,
        thread_waiting_list: []
    };
};

var _set_ip = function(m, tid, to) {
    var thread = m.threads[tid];
    var program_name = thread.program_name;
    var program = m.programs[program_name];
    
    if (to <= program.length) { thread.ip = to; }  
};

// increment instruction pointer for thread tid
var _incr_ip = function(m, tid) {
    var thread = m.threads[tid];
    _set_ip(m, tid, thread.ip + 1);
};

// Instructions

var I_semaphore_make = function(name, initial_count) {
    this.name = name;
    this.count = initial_count;
    this.apply = function(m, current_thread_id) {
        m[name] = _new_semaphore(name, initial_count);
        
       _incr_ip(m, current_thread_id);
    };
    this.human_readable_string = function() {
        return "semaphore_make " + this.name;
    };
};

var I_semaphore_p = function(name) {
    this.apply = function(m, current_thread_id) {
        var semaphore = m[name];
        
        semaphore.count--;
        if (semaphore.count < 0) {
            semaphore.thread_waiting_list.push(current_thread_id);
            m.threads[current_thread_id].runnable = false;
        }
        
        _incr_ip(m, current_thread_id);
    };
    this.human_readable_string = function() {
        return "semaphore_p " + name;
    };
};

var I_semaphore_v = function(name) {
    this.apply = function(m, current_thread_id) {
        var semaphore = m[name];
        
        if (semaphore.count < 0) {
            var thread_id = semaphore.thread_waiting_list.pop();
            m.threads[thread_id].runnable = true;
        }
        semaphore.count++;
        
       _incr_ip(m, current_thread_id);
    };
    this.human_readable_string = function() {
        return "semaphore_v " + name;
    };
};

var I_print = function(s) {
    this.s = s;
    this.apply = function(m, current_thread_id) {
        println(s);  
        
       _incr_ip(m, current_thread_id);
    };
    this.human_readable_string = function() {
        return "print '" + this.s + "'";
    };
};

var I_spawn_thread = function(program_name) {
    this.apply = function(m, current_thread_id) {
        m.threads.push(_new_thread(program_name));
        
       _incr_ip(m, current_thread_id);
    };
    this.human_readable_string = function() {
        return "spawn_thread '" + program_name + "'";
    };
};

var I_jmp = function(to) {
    this.apply = function(m, current_thread_id) {
       _set_ip(m, current_thread_id, to);
    };
    this.human_readable_string = function() {
        return "jmp " + to + "";
    };
};

// Working memory

var M = {
    programs: {},
    threads: [ _new_thread("start") ]
};

// Code

// entry point
M.programs.start = [
    new I_semaphore_make("s", 1),
    new I_spawn_thread("program0"),
    new I_spawn_thread("program1"),
    new I_print("started!"),
    new I_jmp(0)
];

M.programs.program0 = [
    new I_semaphore_p("s"),
    new I_print("program0"),
    new I_semaphore_v("s")
];

M.programs.program1 = [
    new I_semaphore_p("s"),
    new I_print("program1"),
    new I_semaphore_v("s")
];

// x-ray vision into the CPU
var draw_instruction = function(instruction, current, runnable, r) {
    var padding = 10;
    
    var y = r.y + padding;
    var x = r.x + padding;
    var instr_width = r.width - 2 * padding;
    var fontSize = instr_width / 15;
    
    // border
    if (current === true) {
        if (runnable) {
            fill(101, 189, 0);
        } else {
            fill(128, 128, 128);
        }
    } else {
        noFill();
    }
    r.height = padding * 2 + fontSize;
    rect(r.x, r.y, r.width, r.height);

    // text
    if (current === true) {
        fill(255, 255, 255);
    } else {
        fill(0, 0, 0);
    }
    textFont(createFont("monospace"), fontSize);
    textAlign(CENTER, TOP);
    text(instruction.human_readable_string(), x + instr_width / 2, y);

    return r.height;
};

var draw_ip_arrow = function(x, y, side) {
    fill(255, 0, 0);
    
    noStroke();
    triangle(x, y, x - side, y - side / 2, x - side, y + side / 2);
    stroke(0, 0, 0);
};

var draw_thread = function(m, thread, r) {
    if (thread.runnable) {
        fill(255, 255, 255);   
    } else {
        fill(192, 192, 192);
    }
    rect(r.x, r.y, r.width, r.height);
    
    var padding = r.width / 20;

    var width = r.width - 2 * padding;
    var x = r.x + padding;
    var y = r.y + padding;
    
    var program = m.programs[thread.program_name];
    for (var i = 0; i < program.length; i++) {
        var is_ip_at_instruction = i === thread.ip;
        
        var height = draw_instruction(program[i], is_ip_at_instruction, thread.runnable, { x: x, y: y, width: width });
        if (is_ip_at_instruction) { draw_ip_arrow(x, y, padding); }    
        
        y += height + padding;
    }
};

var Layout = function(m) {
    var margin = 10;
    var padding = 10;

    var n = m.threads.length;
    
    var avail_height = height - 2 * margin;
    var avail_width = width - 2 * margin;
    var total_padding_width = (n - 1) * padding; // yeah, n > 0
    
    this.thread_width = (avail_width - total_padding_width) / n;
    this.thread_height = avail_height - 20;
    this.rect = { x: margin, y: margin, width: avail_width, height: avail_height };
    this.padding = padding;
    
    this.tick_button_i = function(x, y) {
        var i_fraction = x / (width / n); // approximately!
        return i_fraction | 0; // float -> int in javascript...
    };
};

var draw_canvas = function(m) {
    background(255, 255, 255);

    var layout = new Layout(m);
    var rect = layout.rect;
    
    var x = rect.x;
    var y = rect.y;
    for (var i = 0; i < m.threads.length; i++) {
        draw_thread(m, m.threads[i], { x: x, y: y, width: layout.thread_width, height: layout.thread_height });
        x += layout.padding + layout.thread_width;
    }
};

// CPU
var core_count = 1; // unused

var tick_thread = function(m, thread_i) {
    var thread = m.threads[thread_i];
    var program = m.programs[thread.program_name];

    if (thread.runnable && thread.ip < program.length) {
        // get instruction
        var instruction = program[thread.ip];
    
        // execute instruction
        instruction.apply(m, thread_i);
    }
    
    draw_canvas(m);
};

var boot = function(m) {
    draw_canvas(m);
};

// BIOS (I might be taking this analogy too far...)
boot(M);

// quartz crystal + scheduler
var mouseClicked = function() {
    var layout = new Layout(M);
    var thread_i = layout.tick_button_i(mouseX, mouseY);
    debug(thread_i);
    tick_thread(M, thread_i);
};
