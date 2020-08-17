export class Stopwatch {
    st;

    et;

    ct;

    times = [];

    isStart = false;

    constructor(isStart = true, msg) {
        if (isStart) {
            this.start(msg);
        }
    }

    start(msg) {
        if (this.isStart) {
            console.warn('Stopwatch has started.');
            return;
        }
        this.isStart = true;
        this.st = new Date();
        this.ct = this.st;
        this.times = [];
        console.log(`Start Time: ${this.st.toLocaleString()}, Msg: ${msg}`);
    }

    stop(msg) {
        this.isStart = false;
        this.et = new Date();
        console.log(`End Time: ${this.st.toLocaleString()}, Elapsed Time: ${this.st.getTime() - this.et.getTime()}, Msg: ${msg}`);
    }

    time(msg) {
        if (!this.isStart) {
            console.warn('Stopwatch does not start.');
        }
        const d = new Date();
        const time = {
            d: d.getTime() - this.ct.getTime(),
            msg: msg
        };
        this.times.push(time);
        console.log(`Index: ${this.times.length - 1}, Time: ${time.d}, Msg: ${time.msg}`);
        this.ct = d;
    }

    showTimes() {
        for (let i = 0; i < this.times.length; i++) {
            const time = this.times[i];
            console.log(`Index: ${this.times.length - 1}, Time: ${time.d},  Msg: ${time.msg}`);
        }
    }

    reset(isStart = true) {
        if (this.isStart) {
            this.stop();
        }
        if (isStart) {
            this.start();
        }
    }
}
