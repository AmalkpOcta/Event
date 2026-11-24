export function Footer() {
  return (
    <footer id="contact" className="scroll-mt-20 border-t border-zinc-200 bg-zinc-950 text-zinc-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 text-center sm:px-6 md:grid-cols-3 md:gap-8 md:py-14 md:text-left">
        <div>
          <p className="text-lg font-semibold text-white">
            Event<span className="text-rose-500">Hive</span>
          </p>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-zinc-400 md:mx-0">
            Create, organize, and conduct quizzes and surveys for your company or
            team — from registration to live results.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
            Contact
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href="mailto:sales@octaunitech.com" className="hover:text-white">
                sales@octaunitech.com
              </a>
            </li>
            <li>
              <a href="tel:+918041739027" className="hover:text-white">
                +91 80 41739027
              </a>
            </li>
            <li className="text-zinc-400">Mon–Fri, 9:00–18:00 IST</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
            Address
          </h3>
          <address className="mt-4 not-italic text-sm leading-relaxed text-zinc-400">
            OctaUnitech Solutions Pvt Ltd
            <br />
            #914, 8th Floor, Oxford Towers
            <br />
            HAL Old Airport Rd, Kodihalli
            <br />
            Bengaluru, Karnataka 560008
          </address>
        </div>
      </div>
      <div className="border-t border-zinc-800">
        <p className="px-4 py-4 text-center text-xs text-zinc-500 sm:px-6">
          © {new Date().getFullYear()} EventHive. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
